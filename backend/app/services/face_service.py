import cv2
import uuid
import os
import numpy as np
from uniface import FaceAnalyzer
from uniface.detection import SCRFD
from uniface.recognition import ArcFace
from uniface.constants import SCRFDWeights, ArcFaceWeights
from app.core.config import GALLERY_DIR, THRESHOLD
from app.services.db_service import get_db, load_db, save_db

# Initialize high-accuracy SCRFD detector (10G with keypoints) and ResNet ArcFace recognizer
detector = SCRFD(
    model_name=SCRFDWeights.SCRFD_10G_KPS,
    confidence_threshold=0.5,
    nms_threshold=0.4,
    input_size=(640, 640)
)
recognizer = ArcFace(model_name=ArcFaceWeights.RESNET)
_analyzer = FaceAnalyzer(detector=detector, recognizer=recognizer)

# Cache variables for vectorized matching
_cached_person_ids = []
_cached_matrix = None

def get_embedding_cache():
    """
    Retrieves or builds the numpy matrix of all registered face embeddings.
    Auto-updates when people are added or removed.
    """
    global _cached_person_ids, _cached_matrix
    load_db()
    db = get_db()
    persons = db.get("persons", {})
    current_ids = list(persons.keys())
    
    if set(current_ids) != set(_cached_person_ids):
        if not current_ids:
            _cached_person_ids = []
            _cached_matrix = None
        else:
            embeddings = []
            for pid in current_ids:
                emb = persons[pid]["representative_embedding"]
                embeddings.append(emb)
            _cached_person_ids = current_ids
            # Convert list of vectors to (N, 512) numpy matrix
            _cached_matrix = np.array(embeddings, dtype=np.float32)
            
    return _cached_person_ids, _cached_matrix

def extract_embedding(image_data):
    """
    Extracts face embeddings from an image using UniFace.
    Filters out low-confidence face detections (< 0.6).
    """
    try:
        faces = _analyzer.analyze(image_data)
        valid_embeddings = []
        for face in faces:
            # Check 'confidence' first (UniFace default), fallback to 'score' or 'det_score'
            score = getattr(face, "confidence", getattr(face, "score", getattr(face, "det_score", 0.0)))
            if score >= 0.6 and face.embedding is not None:
                emb = face.embedding.tolist() if hasattr(face.embedding, "tolist") else face.embedding
                valid_embeddings.append(emb)
        return valid_embeddings
    except Exception as e:
        print(f"Error during embedding extraction: {e}")
        return []

def compare_embeddings(emb1, emb2):
    """
    Computes cosine similarity between two embeddings.
    """
    from numpy.linalg import norm
    return np.dot(emb1, emb2) / (norm(emb1) * norm(emb2))

def register_face(person_id, embedding, photo_url):
    """
    Registers a new face or updates an existing one in the database.
    """
    db = get_db()
    if "persons" not in db:
        db["persons"] = {}
        
    if person_id not in db["persons"]:
        db["persons"][person_id] = {
            "representative_embedding": embedding,
            "photos": []
        }
        
    if photo_url not in db["persons"][person_id]["photos"]:
        db["persons"][person_id]["photos"].append(photo_url)

def recognize_faces(image_data, threshold=THRESHOLD):
    """
    Recognizes faces in the given image using vectorized matrix matching.
    Returns matched person IDs and count of detected faces.
    """
    embeddings = extract_embedding(image_data)
    matched_ids = []
    
    if not embeddings:
        return matched_ids, 0
        
    person_ids, matrix = get_embedding_cache()
    if matrix is None or len(person_ids) == 0:
        return matched_ids, len(embeddings)
        
    for emb in embeddings:
        query_vec = np.array(emb, dtype=np.float32)
        dot_products = np.dot(matrix, query_vec)
        matrix_norms = np.linalg.norm(matrix, axis=1)
        query_norm = np.linalg.norm(query_vec)
        denom = matrix_norms * query_norm
        
        # Guard against zero-division
        similarities = np.divide(dot_products, denom, out=np.zeros_like(dot_products), where=denom != 0)
        
        best_idx = np.argmax(similarities)
        best_sim = similarities[best_idx]
        
        if best_sim >= threshold:
            matched_ids.append(person_ids[best_idx])
            
    return matched_ids, len(embeddings)

def process_image_background(img, final_filename, original_name):
    """
    Analyzes uploaded gallery photos in the background.
    Groups faces using vectorized matching or registers new ones.
    """
    try:
        group_photos_dir = os.path.join(GALLERY_DIR, "Group photo")
        unrecognized_dir = os.path.join(GALLERY_DIR, "unrecognized")
        
        # Preprocessing: downscale for faster background detection
        max_size = 800
        h, w = img.shape[:2]
        if max(h, w) > max_size:
            scale = max_size / max(h, w)
            proc_img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        else:
            proc_img = img

        faces = _analyzer.analyze(proc_img)
        
        # Filter detections below 0.6 score to keep the database clean
        valid_faces = []
        for face in faces:
            score = getattr(face, "confidence", getattr(face, "score", getattr(face, "det_score", 0.0)))
            if score >= 0.6 and face.embedding is not None:
                valid_faces.append(face)
        
        load_db()
        db = get_db()
        
        if len(valid_faces) == 0:
            dest_dir = unrecognized_dir
            relative_path = f"unrecognized/{final_filename}"
            file_path = os.path.join(GALLERY_DIR, relative_path)
            cv2.imwrite(file_path, img)
            return
            
        if len(valid_faces) > 1:
            dest_dir = group_photos_dir
            relative_path = f"Group photo/{final_filename}"
        else:
            dest_dir = None
            relative_path = None
            
        person_ids, matrix = get_embedding_cache()
        matched_person_ids = []
        
        for face in valid_faces:
            emb = face.embedding.tolist() if hasattr(face.embedding, "tolist") else face.embedding
            query_vec = np.array(emb, dtype=np.float32)
            matched_id = None
            
            if matrix is not None and len(person_ids) > 0:
                dot_products = np.dot(matrix, query_vec)
                matrix_norms = np.linalg.norm(matrix, axis=1)
                query_norm = np.linalg.norm(query_vec)
                denom = matrix_norms * query_norm
                similarities = np.divide(dot_products, denom, out=np.zeros_like(dot_products), where=denom != 0)
                
                best_idx = np.argmax(similarities)
                best_sim = similarities[best_idx]
                
                if best_sim >= THRESHOLD:
                    matched_id = person_ids[best_idx]
            
            if not matched_id:
                matched_id = f"person_{uuid.uuid4().hex[:8]}"
                db["persons"][matched_id] = {
                    "representative_embedding": emb,
                    "photos": []
                }
                # Dynamic rebuild of embedding cache to allow immediate matching of other faces in same image
                person_ids, matrix = get_embedding_cache()
            
            matched_person_ids.append(matched_id)
            
        if len(valid_faces) == 1:
            person_id = matched_person_ids[0]
            dest_dir = os.path.join(GALLERY_DIR, person_id)
            os.makedirs(dest_dir, exist_ok=True)
            relative_path = f"{person_id}/{final_filename}"
            file_path = os.path.join(GALLERY_DIR, relative_path)
            cv2.imwrite(file_path, img)
            
            photo_url = f"/gallery/{relative_path}"
            register_face(person_id, db["persons"][person_id]["representative_embedding"], photo_url)
        elif len(valid_faces) > 1:
            # Save main image once into Group photo directory
            group_file_path = os.path.join(group_photos_dir, final_filename)
            cv2.imwrite(group_file_path, img)
            group_photo_url = f"/gallery/Group photo/{final_filename}"
            
            # Register group photo URL for each matched person
            for pid in set(matched_person_ids):
                register_face(pid, db["persons"][pid]["representative_embedding"], group_photo_url)
                
        save_db()

        
        # Generate cropped face avatar for matched persons
        for pid in set(matched_person_ids):
            try:
                generate_avatar_for_person(pid)
            except Exception:
                pass
    except Exception as e:
        import traceback
        print(f"Error in background processing: {e}")
        traceback.print_exc()

def sync_group_photos_to_personal_folders():
    """
    Retroactively syncs existing group photos into personal folders for all registered persons.
    Copies physical files from 'Group photo/filename' into '{person_id}/filename' and updates database.
    """
    import shutil
    try:
        load_db()
        db = get_db()
        persons = db.get("persons", {})
        if not persons:
            return 0
            
        synced_count = 0
        updated = False
        
        for pid, pdata in list(persons.items()):
            photos = list(pdata.get("photos", []))
            person_dir = os.path.join(GALLERY_DIR, pid)
            
            for photo_url in photos:
                if "/gallery/Group photo/" in photo_url:
                    filename = os.path.basename(photo_url)
                    src_file = os.path.join(GALLERY_DIR, "Group photo", filename)
                    
                    if os.path.exists(src_file):
                        os.makedirs(person_dir, exist_ok=True)
                        dest_file = os.path.join(person_dir, filename)
                        if not os.path.exists(dest_file):
                            shutil.copy2(src_file, dest_file)
                            synced_count += 1
                        
                        personal_photo_url = f"/gallery/{pid}/{filename}"
                        if personal_photo_url not in pdata["photos"]:
                            pdata["photos"].append(personal_photo_url)
                            updated = True
                            
        if updated:
            save_db()
        print(f"Group photos sync complete: copied/verified {synced_count} file(s).")
        return synced_count
    except Exception as e:
        import traceback
        print(f"Error syncing group photos: {e}")
        traceback.print_exc()
        return 0

def generate_avatar_for_person(person_id, force=False):
    """
    Generates a cropped face avatar image for the given person_id and saves it to
    GALLERY_DIR/{person_id}/avatar.jpg.
    Prioritizes single-person photos over group photos.
    """
    try:
        person_dir = os.path.join(GALLERY_DIR, person_id)
        os.makedirs(person_dir, exist_ok=True)
        avatar_path = os.path.join(person_dir, "avatar.jpg")
        
        if os.path.exists(avatar_path) and not force:
            return avatar_path
            
        load_db()
        db = get_db()
        pdata = db.get("persons", {}).get(person_id)
        if not pdata or "representative_embedding" not in pdata:
            return None
            
        rep_emb = np.array(pdata["representative_embedding"], dtype=np.float32)
        photos = pdata.get("photos", [])
        if not photos:
            return None
            
        # Separate single photos from group photos
        single_photos = [u for u in photos if not u.startswith("/gallery/Group photo/") and os.path.basename(u) != "avatar.jpg"]
        group_photos = [u for u in photos if u.startswith("/gallery/Group photo/") and os.path.basename(u) != "avatar.jpg"]
        
        candidate_photos = single_photos + group_photos
        
        for photo_url in candidate_photos:
            rel_path = photo_url.replace("/gallery/", "")
            img_path = os.path.normpath(os.path.join(GALLERY_DIR, rel_path))
            
            if not os.path.exists(img_path):
                continue
                
            img = cv2.imread(img_path)
            if img is None:
                continue
                
            faces = _analyzer.analyze(img)
            if not faces:
                continue
                
            best_face = None
            max_sim = -1.0
            
            for f in faces:
                if f.embedding is not None and getattr(f, "bbox", None) is not None:
                    f_emb = np.array(f.embedding, dtype=np.float32)
                    norm1 = np.linalg.norm(f_emb)
                    norm2 = np.linalg.norm(rep_emb)
                    if norm1 > 0 and norm2 > 0:
                        sim = np.dot(f_emb, rep_emb) / (norm1 * norm2)
                        if sim > max_sim:
                            max_sim = sim
                            best_face = f
                            
            if best_face is not None and max_sim >= 0.35:
                h, w = img.shape[:2]
                bbox = best_face.bbox
                x1, y1, x2, y2 = [int(v) for v in bbox]
                fw, fh = x2 - x1, y2 - y1
                pad = int(max(fw, fh) * 0.45)
                px1, py1 = max(0, x1 - pad), max(0, y1 - pad)
                px2, py2 = min(w, x2 + pad), min(h, y2 + pad)
                
                crop = img[py1:py2, px1:px2]
                if crop.size > 0:
                    cv2.imwrite(avatar_path, crop)
                    return avatar_path
                    
        return None
    except Exception as e:
        print(f"Error generating avatar for {person_id}: {e}")
        return None

def generate_avatars_for_all_persons(force=False):
    """
    Generates cropped face avatars for all registered persons in the database.
    """
    try:
        load_db()
        db = get_db()
        persons = db.get("persons", {})
        count = 0
        for pid in list(persons.keys()):
            res = generate_avatar_for_person(pid, force=force)
            if res:
                count += 1
        print(f"Generated/verified cropped face avatars for {count} person(s).")
        return count
    except Exception as e:
        print(f"Error generating avatars for all persons: {e}")
        return 0


