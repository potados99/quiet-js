const audioContext = new AudioContext();

let payload;
let received = '';

function onFileRead(e) {
    payload = e.target.result;
}

function onFileSelect(e) {
    const reader = new FileReader()
    reader.onload = onFileRead;
    reader.readAsArrayBuffer(e.target.files[0]);
}

function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function downloadFile(data) {
    location.href = "data:application/octet-stream;base64," + data;
}

async function main() {
    const quiet = await new Quiet(
        audioContext,
        quietProfiles['cable-64k'],
    ).init();

    function sendText(payload) {
        // downloadFile(payload);
        quiet.transmit({
            clampFrame: false,
            payload,
        });
    }

    document.querySelector('#transmit-input').addEventListener('change', onFileSelect, false);

    document
        .querySelector('#audible-file')
        .addEventListener('submit', (e) => {
            sendText(arrayBufferToBase64(payload));
            e.preventDefault();
        });

    document
        .querySelector('#start-listening')
        .addEventListener('click', () => {
            quiet.receive((data) => {
                received += data;

                downloadFile(received);
            });
        });
}

main();
