const audioContext = new AudioContext();

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const profile = quietProfiles[urlParams.get('profile')] || quietProfiles['cable-64k'];

if (urlParams.get('profile') != null && quietProfiles[urlParams.get('profile')] == null) {
  alert(`[${urlParams.get('profile')}] 프로파일이 없어 cable-64k가 사용됩니다.`);
}

async function main() {
  const quiet = await new Quiet(
    audioContext,
    profile,
  ).init();

  function sendText(text) {
    const unescaped = btoa(unescape(encodeURIComponent(text)));
    sendJson({type: 'text', text: unescaped});
  }

  function sendFile(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
      sendJson({
        type: 'file',
        name: file.name,
        mime: file.type,
        size: file.size,
        url: e.target.result
      });
    }

    reader.readAsDataURL(file);
  }

  function sendJson(json) {
    quiet.transmit({
      clampFrame: false,
      payload: JSON.stringify(json)
    });
  }

  async function startReceiving() {
    await quiet.receive((message) => {
      const parsed = JSON.parse(message);
      const {type} = parsed;

      switch (type) {
        case 'text':
          receivedText.innerHTML += decodeURIComponent(escape(atob(parsed.text)));
          break;
        case 'file':
          receivedFiles.innerHTML += `<li><a download="${parsed.name}" href="${parsed.url}">${parsed.name}</a></li>`;
          break;
      }
    });
  }

  document
    .querySelector('#audible-text')
    .addEventListener('submit', (e) => {
      const {value} = e.target.querySelector('textarea');
      e.preventDefault();
      sendText(value);
    });

  document
    .querySelector('#audible-file')
    .addEventListener('submit', (e) => {
      e.preventDefault();
      sendFile(document.querySelector('#transmit-input').files[0]);
    });

  const receivedText = document.querySelector('#received-text');
  const receivedFiles = document.querySelector('#received-files');

  document
    .querySelector('#start-listening')
    .addEventListener('click', () => {
      startReceiving().catch(alert);
    });
}

main();
