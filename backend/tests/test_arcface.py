import os
import cv2
import numpy as np
from uniface import FaceAnalyzer

_analyzer = FaceAnalyzer()
from numpy.linalg import norm

def compute_similarity(emb1, emb2):
    return np.dot(emb1, emb2) / (norm(emb1) * norm(emb2))

folders = [
    "gallery/person_5acb5dbd",
    "gallery/person_2f98b644",
    "gallery/person_1b15ec0b",
    "gallery/person_58df1b54"
]

images = []
for f in folders:
    for filename in os.listdir(f):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            images.append((f.split('/')[-1], os.path.join(f, filename)))
            break # just take one from each

embeddings = []
for p, path in images:
    try:
        faces = _analyzer.analyze(cv2.imread(path))
        if faces:
            emb = faces[0].embedding
            if hasattr(emb, "tolist"):
                emb = emb.tolist()
            embeddings.append(emb)
    except Exception as e:
        print(f"Error {path}: {e}")

for i in range(len(embeddings)):
    for j in range(i+1, len(embeddings)):
        sim = compute_similarity(np.array(embeddings[i]), np.array(embeddings[j]))
        print(f"ArcFace Sim {images[i][0]} & {images[j][0]}: {sim:.4f}")
