import urllib.request
import json
import os

def test_upload():
    # Pick an image from the gallery to guarantee a match
    image_path = "gallery/person_2674f70c/49a0b418_IMG-20180726-WA0017.jpg"
    if not os.path.exists(image_path):
        print(f"File not found: {image_path}")
        return
        
    url = "http://localhost:10000/api/recognize"
    
    # Simple multipart form-data upload using urllib
    import mimetypes
    import uuid
    
    boundary = uuid.uuid4().hex
    headers = {'Content-type': f'multipart/form-data; boundary={boundary}'}
    
    with open(image_path, 'rb') as f:
        file_content = f.read()
        
    data = []
    data.append(f'--{boundary}'.encode())
    data.append(f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(image_path)}"'.encode())
    data.append(f'Content-Type: image/jpeg'.encode())
    data.append(b'')
    data.append(file_content)
    data.append(f'--{boundary}--'.encode())
    data.append(b'')
    
    body = b'\r\n'.join(data)
    
    try:
        req = urllib.request.Request(url, data=body, headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            result = response.read().decode()
            print("Status Code:", response.getcode())
            print("Response:", result)
    except Exception as e:
        print("Error:", e)
        if hasattr(e, 'read'):
            print("Body:", e.read().decode())

if __name__ == '__main__':
    test_upload()
