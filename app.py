import os
import datetime
import numpy as np
import cv2
import easyocr
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()

# Carpeta donde se guardan las imágenes de debug
DEBUG_ROOT = "debug_images"
os.makedirs(DEBUG_ROOT, exist_ok=True)

# Montar rutas estáticas
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/debug",  StaticFiles(directory=DEBUG_ROOT), name="debug")

# Templates
templates = Jinja2Templates(directory="static/templates")

# Inicializar EasyOCR
reader = easyocr.Reader(['en'])

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/detectar")
async def detectar(file: UploadFile = File(...)):
    # 1) Leer la imagen subida
    data = await file.read()
    img_array = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="No se pudo decodificar la imagen")

    # 2) Crear carpeta debug timestamp
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    debug_dir = os.path.join(DEBUG_ROOT, ts)
    os.makedirs(debug_dir, exist_ok=True)

    # 3) Preprocesado
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255,
                              cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    cv2.imwrite(os.path.join(debug_dir, "binary.png"), binary)

    # 4) Detección con detalle
    detections = reader.readtext(binary, detail=1)

    # 5) Dibujar y recortar
    annotated = img.copy()
    expr = ""
    for idx, (bbox, text, conf) in enumerate(detections):
        pts = np.array(bbox).astype(int)
        xs, ys = pts[:,0], pts[:,1]
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()

        # Guardar recorte
        crop = img[y0:y1, x0:x1]
        safe = text.replace("/", "_").replace("\\", "_")
        cv2.imwrite(os.path.join(debug_dir, f"{idx}_{safe}.png"), crop)

        # Anotar en la imagen
        cv2.rectangle(annotated, (x0, y0), (x1, y1), (0,255,0), 2)
        cv2.putText(annotated, text, (x0, y0-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)

        expr += text

    # 6) Guardar anotada completa
    ann_path = os.path.join(debug_dir, "annotated.png")
    cv2.imwrite(ann_path, annotated)

    # 7) Normalizar y evaluar
    expr_norm = expr.replace('x','*').replace('X','*')\
                    .replace('÷','/').replace('=','').strip()
    result = None
    try:
        if any(op in expr_norm for op in ['+','-','*','/']):
            result = eval(expr_norm)
    except Exception:
        result = "Error en evaluación"

    # 8) Devolver JSON con URL del debug
    return JSONResponse({
        "expresion": expr_norm,
        "resultado": result,
        "mensaje_db": "✅ Procesado correctamente",
        "annotated_url": f"/debug/{ts}/annotated.png"
    })
