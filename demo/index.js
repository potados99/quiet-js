const chunkSize = 1024;
const audioContext = new AudioContext();

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const profile = quietProfiles[urlParams.get('profile')] || quietProfiles['cable-64k'];

if (urlParams.get('profile') != null && quietProfiles[urlParams.get('profile')] == null) {
  alert(`[${urlParams.get('profile')}] 프로파일이 없어 cable-64k가 사용됩니다.`);
}

async function sleep(millis) {
  return new Promise((res, rej) => setTimeout(() => res(), millis));
}

function splitString(str, N) {
  const arr = [];

  for (let i = 0; i < str.length; i += N) {
    arr.push(str.substring(i, i + N));
  }

  return arr;
}

function decode(buf) {
  return [...new Uint8Array(buf)].map((x) => String.fromCharCode(x)).join('');
}

let currentFile;

async function main() {
  const quiet = await new Quiet(
    audioContext,
    profile,
  ).init();

  const socket = new Socket('Alpha');

  function sendText(text) {
    const unescaped = btoa(unescape(encodeURIComponent(text)));
    sendJson({type: 'text', text: unescaped});
  }

  async function sendFile(file) {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const payload = e.target.result;

      await sendJson({
        type: 'file-header',
        name: file.name,
        mime: file.type,
        size: payload.length
      });

      //await sleep(1000);

      const chunks = splitString(e.target.result, chunkSize);

      console.log(`${chunks.length} chunks.`);

      let seq = 0;
      let sent = 0;

      document.querySelector('#send-progress-container').setAttribute('style','display: flex');

      for (const chunk of chunks) {
        //await sleep(1000);

        await sendJson({
          type: 'file-body',
          seq: seq,
          chunk: chunk
        });
        sent += chunk.length;
        const progress = 100 * sent / payload.length;

        console.log(`[${seq}] sent ${chunk.length}. they will have ${sent}, which is ${progress}%.`);

        document.querySelector('#send-progress').setAttribute('aria-valuenow',progress);
        document.querySelector('#send-progress').setAttribute('style','width:'+progress+'%');

        seq++;
      }

      document.querySelector('#send-progress-container').setAttribute('style','display: none');
    }

    reader.readAsDataURL(file);
  }

  async function sendJson(json) {
    await socket.send(new TextEncoder().encode(JSON.stringify(json)));
  }

  async function start() {
    await socket.bind(quiet);

    socket.listen((message) => {
      const parsed = JSON.parse(decode(message));
      const {type} = parsed;

      switch (type) {
        case 'text':
          receivedText.innerHTML += decodeURIComponent(escape(atob(parsed.text)));
          break;
        case 'file-header':
          currentFile = {name: parsed.name, size: parsed.size, received: 0, lastSeq: -1, chunks: []};
          console.log(currentFile);
          break;
        case 'file-body':
          if (parsed.seq - currentFile.lastSeq > 1) {
            console.error(`missing message! sequence ${currentFile.lastSeq+1}~${parsed.seq-1} is dropped!`);
          }

          document.querySelector('#receive-progress-container').setAttribute('style','display: flex');

          currentFile.chunks.push(parsed.chunk);
          currentFile.received += parsed.chunk.length;
          currentFile.lastSeq = parsed.seq;

          const progress = 100 * currentFile.received / currentFile.size;

          document.querySelector('#receive-progress').setAttribute('aria-valuenow',progress);
          document.querySelector('#receive-progress').setAttribute('style','width:'+progress+'%');

          console.log(`[${parsed.seq}] received ${parsed.chunk.length}. now have ${currentFile.received}, which is ${progress}%.`);

          if (currentFile.received === currentFile.size) {
            console.log('receive succeeded');
            receivedFiles.innerHTML += `<li><a download="${currentFile.name}" href="${currentFile.chunks.join('')}">${currentFile.name}</a></li>`;
            document.querySelector('#receive-progress-container').setAttribute('style','display: none');
          }

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
    .querySelector('#start')
    .addEventListener('click', () => {
      start();
    });
}

main();
