import json
import cv2
import numpy as np
import time

def test():
    print("Starting test...")
    start = time.time()
    from app.services.db_service import load_db, get_db
    from app.services.face_service import compare_embeddings, extract_embedding
    print(f"Imports done in {time.time()-start:.2f}s")
    
    load_db()
    
    db_data = get_db()
    person_ids = list(db_data["persons"].keys())
    if not person_ids:
        print("No persons found in DB")
        return
        
    p_id = person_ids[0]
    p_data = db_data["persons"][p_id]
    
    if not p_data["photos"]:
        print(f"No photos for {p_id}")
        return
        
    photo_url = p_data["photos"][0]
    photo_path = "." + photo_url
    print(f"Testing photo: {photo_path}")
    
    img = cv2.imread(photo_path)
    if img is None:
        print("Failed to load image")
        return
        
    print("Extracting embeddings...")
    embeddings = extract_embedding(img)
    print(f"Extracted {len(embeddings)} embeddings.")
    
    if not embeddings:
        print("No embeddings found in the test image")
        return
        
    emb = embeddings[0]
    rep_emb = np.array(p_data["representative_embedding"])
    
    sim = compare_embeddings(np.array(emb), rep_emb)
    print(f"Similarity: {sim}")
    
if __name__ == '__main__':
    test()
