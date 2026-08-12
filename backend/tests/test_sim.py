import json
import numpy as np
from numpy.linalg import norm

def compare_embeddings(emb1, emb2):
    return np.dot(emb1, emb2) / (norm(emb1) * norm(emb2))

with open('database.json', 'r') as f:
    db = json.load(f)

persons = db.get("persons", {})
pids = list(persons.keys())

for i in range(len(pids)):
    for j in range(i+1, len(pids)):
        pid1 = pids[i]
        pid2 = pids[j]
        emb1 = np.array(persons[pid1]["representative_embedding"])
        emb2 = np.array(persons[pid2]["representative_embedding"])
        sim = compare_embeddings(emb1, emb2)
        print(f"Similarity between {pid1} and {pid2}: {sim:.4f}")
