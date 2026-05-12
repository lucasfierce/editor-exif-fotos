/**
 * DOCUMENTAÇÃO DAS FUNÇÕES DE SUBSTITUIÇÃO
 * 1. convertToDecimal: Transforma [graus, minutos, segundos] em um número decimal (ex: -7.12)
 * 2. convertToEXIF: Transforma um decimal no formato de array de frações exigido pelo EXIF.
 */

let map, marker, base64Image = "";
let currentExif = { "0th": {}, "Exif": {}, "GPS": {} };
let originalFileName = "imagem_editada.jpg";

// --- LÓGICA MANUAL (SUBSTITUINDO O GPSHELPER) ---

function convertToDecimal(exifCoords, ref) {
    if (!exifCoords) return null;
    // EXIF armazena como [numerador, denominador]. Dividimos um pelo outro.
    const d = exifCoords[0][0] / exifCoords[0][1];
    const m = exifCoords[1][0] / exifCoords[1][1];
    const s = exifCoords[2][0] / exifCoords[2][1];

    let decimal = d + (m / 60) + (s / 3600);
    if (ref === "S" || ref === "W") decimal *= -1;
    return decimal;
}

function convertToEXIF(decimal) {
    const abs = Math.abs(decimal);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = Math.round((abs - d - m / 60) * 3600 * 100); // Usamos 100 para precisão de centésimos

    // Retorna no formato [ [num, den], [num, den], [num, den] ]
    return [ [d, 1], [m, 1], [s, 100] ];
}

// --- FIM DA LÓGICA MANUAL ---

function initMap(lat = -7.1195, lng = -34.8450) {
    if (!map) {
        map = L.map('map').setView([lat, lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        marker = L.marker([lat, lng]).addTo(map);
    } else {
        map.setView([lat, lng], 13);
        marker.setLatLng([lat, lng]);
    }
}

// Atualiza o mapa em tempo real ao digitar
const updateMap = () => {
    const lat = parseFloat(document.getElementById('latInput').value);
    const lng = parseFloat(document.getElementById('lngInput').value);
    if (!isNaN(lat) && !isNaN(lng)) initMap(lat, lng);
};

document.getElementById('latInput').addEventListener('input', updateMap);
document.getElementById('lngInput').addEventListener('input', updateMap);

document.getElementById('fileInput').onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // CAPTURA DO NOME ORIGINAL
    originalFileName = file.name;

    const reader = new FileReader();
    reader.onload = function(event) {
        base64Image = event.target.result;
        document.getElementById('preview').src = base64Image;
        document.getElementById('preview').style.display = "block";

        try {
            currentExif = piexif.load(base64Image);
            
            // Data
            const date = currentExif["0th"][piexif.ImageIFD.DateTime] || "";
            document.getElementById('dateInput').value = date;
            document.getElementById('tiradaEm').innerText = `Tirada em: ${date}`;

            // GPS (Usando nossa função manual)
            if (currentExif["GPS"] && currentExif["GPS"][piexif.GPSIFD.GPSLatitude]) {
                const lat = convertToDecimal(currentExif["GPS"][piexif.GPSIFD.GPSLatitude], currentExif["GPS"][piexif.GPSIFD.GPSLatitudeRef]);
                const lng = convertToDecimal(currentExif["GPS"][piexif.GPSIFD.GPSLongitude], currentExif["GPS"][piexif.GPSIFD.GPSLongitudeRef]);
                
                document.getElementById('latInput').value = lat.toFixed(6);
                document.getElementById('lngInput').value = lng.toFixed(6);
                initMap(lat, lng);
            }
        } catch (err) { console.log("Erro ao carregar EXIF"); }
    };
    reader.readAsDataURL(file);
};

document.getElementById('saveBtn').onclick = function() {
    if (!base64Image) return alert("Selecione uma imagem!");

    const newDate = document.getElementById('dateInput').value; // Ex: "2026:05:08 10:30:00"
    // 1. Gravar na Seção 0th (Informação geral)
    currentExif["0th"][piexif.ImageIFD.DateTime] = newDate;

    // 2. Gravar na Seção Exif (Informação técnica/original)
    // É aqui que o sistema operacional busca o "Data e hora (original)"
    currentExif["Exif"][piexif.ExifIFD.DateTimeOriginal] = newDate;
    currentExif["Exif"][piexif.ExifIFD.DateTimeDigitized] = newDate;

    // Grava GPS (Usando nossa função manual)
    const lat = parseFloat(document.getElementById('latInput').value);
    const lng = parseFloat(document.getElementById('lngInput').value);

    if (!isNaN(lat) && !isNaN(lng)) {
        currentExif["GPS"][piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? "N" : "S";
        currentExif["GPS"][piexif.GPSIFD.GPSLatitude] = convertToEXIF(lat);
        currentExif["GPS"][piexif.GPSIFD.GPSLongitudeRef] = lng >= 0 ? "E" : "W";
        currentExif["GPS"][piexif.GPSIFD.GPSLongitude] = convertToEXIF(lng);
    }

    const exifBytes = piexif.dump(currentExif);
    const newBase64 = piexif.insert(exifBytes, base64Image);

    const link = document.createElement("a");
    link.href = newBase64;
    const nameParts = originalFileName.split('.');
    const ext = nameParts.pop();
    const nameOnly = nameParts.join('.');
    link.download = `${nameOnly}_editado.${ext}`;
    link.click();
};

window.onload = () => initMap();