import cv2
from deepface import DeepFace

img_path = r"c:\Users\hanan\Documents\Face_Recognition_System\backend\gallery\Group photo\40cd346f_316fd138_a3c66749_WhatsApp Image 2026-03-31 at 8.07.04 AM (1).jpeg"
results = DeepFace.represent(img_path=img_path, model_name="ArcFace", detector_backend="mtcnn", enforce_detection=False)
for i, res in enumerate(results):
    print(f"Face {i}: Confidence = {res.get('face_confidence', 'N/A')}")
