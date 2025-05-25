// static/js/app.js

let imagenBlob   = null;
let annotatedUrl = null;

// DOM refs
const inputFile    = document.getElementById("imagen");
const btnAbrirCam  = document.getElementById("btnAbrirCamara");
const btnCapturar  = document.getElementById("btnCapturarFoto");
const btnProcesar  = document.getElementById("btnProcesar");
const btnDebug     = document.getElementById("btnDebug");
const videoEl      = document.getElementById("video");
const canvas       = document.getElementById("canvas");
const preview      = document.getElementById("preview");
const resultadoEl  = document.getElementById("resultado");
const expresionEl  = document.getElementById("expresion");
const valorEl      = document.getElementById("resultadoValor");
const mensajeDBEl  = document.getElementById("mensaje-db");
const debugImage   = document.getElementById("debugImage");

// Sólo oculta la imagen debug, no el botón
function resetDebug() {
  annotatedUrl = null;
  debugImage.style.display = "none";
}

// Cuando seleccionas un archivo
inputFile.addEventListener("change", () => {
  const file = inputFile.files[0];
  if (!file) return;
  imagenBlob = file;
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
  resultadoEl.style.display = "none";
  mensajeDBEl.style.display = "none";
  resetDebug();
  btnProcesar.disabled = false;
});

// Abrir cámara
btnAbrirCam.addEventListener("click", async () => {
  resetDebug();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoEl.srcObject = stream;
    videoEl.style.display      = "block";
    btnCapturar.style.display  = "inline-block";
    btnProcesar.disabled       = true;
  } catch (e) {
    alert("No se pudo activar la cámara: " + e.message);
  }
});

// Capturar foto
btnCapturar.addEventListener("click", () => {
  resetDebug();
  const ctx = canvas.getContext("2d");
  canvas.width  = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  ctx.drawImage(videoEl, 0, 0);
  videoEl.srcObject.getTracks().forEach(t => t.stop());
  videoEl.style.display     = "none";
  btnCapturar.style.display = "none";

  canvas.toBlob(blob => {
    imagenBlob = blob;
    preview.src = URL.createObjectURL(blob);
    preview.style.display = "block";
    btnProcesar.disabled  = false;
  }, "image/jpeg");
});

// Procesar imagen (invocado por onclick inline)
async function enviarImagen() {
  if (!imagenBlob) {
    alert("Selecciona o captura una imagen.");
    return;
  }
  resetDebug();

  const fd = new FormData();
  fd.append("file", imagenBlob, "imagen.jpg");

  try {
    const resp = await fetch("https://detector-operaciones.onrender.com/detectar", {
  method: "POST", body: fd
});
    const data = await resp.json();
    console.log("📑 Payload:", data);

    if (!resp.ok) {
      throw new Error(data.detail || "Error desconocido");
    }

    // Mostrar resultado
    expresionEl.innerText     = data.expresion;
    valorEl.innerText         = data.resultado;
    resultadoEl.style.display = "block";

    // Mensaje DB
    mensajeDBEl.textContent   = data.mensaje_db || "";
    mensajeDBEl.style.color   = data.mensaje_db?.includes("✅") ? "green" : "red";
    mensajeDBEl.style.display = data.mensaje_db ? "block" : "none";

    // Guardar URL de debug
    annotatedUrl = data.annotated_url;
    console.log("Debug URL:", annotatedUrl);
  } catch (err) {
    console.error(err);
    alert("❌ Error al procesar la imagen:\n" + err.message);
  }
}

// Mostrar debug (invocado por onclick inline)
function mostrarDebug() {
  if (!annotatedUrl) {
    alert("Aún no se ha generado la imagen de debug.");
    return;
  }
  // Intentar cargarla y detectar errores
  debugImage.onerror = () => {
    alert("No se pudo cargar la imagen de debug:\n" + debugImage.src);
  };
  debugImage.onload = () => {
    debugImage.style.display = "block";
  };
  debugImage.src = annotatedUrl + "?t=" + Date.now();
}
