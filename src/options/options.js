import formatPrice from '../shared/formatPrice.js';

const portForm = document.getElementById('portForm');
const portInput = document.getElementById('portInput');
const cidPriceForm = document.getElementById('cidPriceForm');
const cidInput = document.getElementById('cidInput');
const priceInput = document.getElementById('priceInput');
const priceTableBody = document.getElementById('priceTableBody');

portForm.onsubmit = event => {
  event.preventDefault();

  const port = parseInt(portInput.value, 10);
  chrome.storage.local.set({ port });

  return false;
};

let pricePerByte = {};

function drawPriceTable() {
  priceTableBody.innerHTML = '';

  Object.entries(pricePerByte)
    .sort(([a], [b]) => {
      if (a === '*') {
        return -1;
      }

      if (b === '*') {
        return 1;
      }

      return a - b;
    })
    .forEach(([cid, price]) => {
      const cidCell = document.createElement('td');
      cidCell.innerHTML = cid;

      const priceCell = document.createElement('td');
      priceCell.innerHTML = formatPrice(price);

      const actionsCell = document.createElement('td');

      if (cid !== '*') {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.innerHTML = 'Remove';
        removeButton.onclick = () => {
          delete pricePerByte[cid];
          chrome.storage.local.set({ pricePerByte });
          drawPriceTable();
        };

        actionsCell.appendChild(removeButton);
      }

      const tr = document.createElement('tr');
      tr.appendChild(cidCell);
      tr.appendChild(priceCell);
      tr.appendChild(actionsCell);

      priceTableBody.appendChild(tr);
    });
}

cidPriceForm.onsubmit = event => {
  event.preventDefault();

  pricePerByte[cidInput.value] = parseFloat(priceInput.value);
  chrome.storage.local.set({ pricePerByte });
  drawPriceTable();

  return false;
};

chrome.storage.local.get(['port', 'pricePerByte'], result => {
  portInput.value = result.port;

  pricePerByte = result.pricePerByte;
  priceInput.value = pricePerByte['*'].toFixed(10);
  drawPriceTable();
});
