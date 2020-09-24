/* global chrome */

import PeerId from 'peer-id';
import Libp2p from 'libp2p';
import Websockets from 'libp2p-websockets';
import WebRTCStar from 'libp2p-webrtc-star';
import Mplex from 'libp2p-mplex';
import { NOISE } from 'libp2p-noise';
import Secio from 'libp2p-secio';
import Gossipsub from 'libp2p-gossipsub';
import Boostrap from 'libp2p-bootstrap';
import topics from 'src/shared/topics';
import messageTypes from 'src/shared/messageTypes';
import getOptions from 'src/shared/getOptions';
import setOptions from 'src/shared/setOptions';
import ports from './ports';
import Lotus from './lotus-client/Lotus';
import Datastore from './Datastore';
import Client from './retrieval-market/Client';
import Provider from './retrieval-market/Provider';

class Node {
  static async create(options) {
    const node = new Node();
    await node.initialize(options);
    return node;
  }

  //Run every 10 minutes
  automationLoopTime = 600000;
  lastIntervalId = 0;

  connectedPeers = new Set();
  queriedCids = new Set();

  async initialize({ rendezvousIp, rendezvousPort, wallet }) {
    // ToDo: remove these lines at cleanup
    // const rendezvousProtocol = /^\d+\.\d+\.\d+\.\d+$/.test(rendezvousIp) ? 'ip4' : 'dns4';
    // const rendezvousWsProtocol = `${rendezvousPort}` === '443' ? 'wss' : 'ws';
    // const rendezvousAddress = `/${rendezvousProtocol}/${rendezvousIp}/tcp/${rendezvousPort}/${rendezvousWsProtocol}/p2p-webrtc-star`;

    ports.postLog('DEBUG: creating peer id');
    this.peerId = await PeerId.create();
    this.id = this.peerId.toB58String();

    ports.postLog('DEBUG: creating libp2p node');
    this.node = await Libp2p.create({
      peerId: this.peerId,
      modules: {
        transport: [Websockets, WebRTCStar],
        streamMuxer: [Mplex],
        connEncryption: [NOISE, Secio],
        pubsub: Gossipsub,
        peerDiscovery: [Boostrap]
      },
      addresses: {
        listen: [
          '/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star',
          //'/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star'
        ],
      },
      config: {
        peerDiscovery: {
          [Boostrap.tag]: {
            enabled: true,
            list: [
              '/dns4/bootstrap-0.testnet.fildev.network/tcp/1347/wss/12D3KooWJTUBUjtzWJGWU1XSiY21CwmHaCNLNYn2E7jqHEHyZaP7',
              '/dns4/bootstrap-1.testnet.fildev.network/tcp/1347/wss/12D3KooW9yeKXha4hdrJKq74zEo99T8DhriQdWNoojWnnQbsgB3v',
              '/dns4/bootstrap-2.testnet.fildev.network/tcp/1347/wss/12D3KooWCrx8yVG9U9Kf7w8KLN3Edkj5ZKDhgCaeMqQbcQUoB6CT',
              '/dns4/bootstrap-4.testnet.fildev.network/tcp/1347/wss/12D3KooWPkL9LrKRQgHtq7kn9ecNhGU9QaziG8R5tX8v9v7t3h34',
              '/dns4/bootstrap-3.testnet.fildev.network/tcp/1347/wss/12D3KooWKYSsbpgZ3HAjax5M1BXCwXLa6gVkUARciz7uN3FNtr7T',
              '/dns4/bootstrap-5.testnet.fildev.network/tcp/1347/wss/12D3KooWQYzqnLASJAabyMpPb1GcWZvNSe7JDcRuhdRqonFoiK9W',
            ]
          }
        }
      }
    });

    ports.postLog('DEBUG: creating lotus client');
    this.lotus = await Lotus.create();

    ports.postLog('DEBUG: creating datastore');
    this.datastore = await Datastore.create('/blocks', {
      prefix: 'filecoin-retrieval',
      version: 1,
    });

    ports.postLog('DEBUG: creating retrieval market client');
    this.client = await Client.create(
      this.node,
      this.datastore,
      this.lotus,
      this.handleCidReceived,
    );

    ports.postLog('DEBUG: creating retrieval market provider');
    this.provider = await Provider.create(this.node, this.datastore, this.lotus);

    ports.postLog('DEBUG: starting libp2p node');
    await this.node.start();

    ports.postLog('DEBUG: adding listeners to node');
    this.node.connectionManager.on('peer:connect', this.handlePeerConnect);
    this.node.connectionManager.on('peer:disconnect', this.handlePeerDisconnect);
    this.node.pubsub.subscribe(topics.filecoinRetrieval, this.handleMessage);

    ports.postLog('DEBUG: getting node info');
    this.getInfo();

    ports.postLog('DEBUG: node created');
  }

  async getInfo() {
    this.multiaddrs = this.node.multiaddrs.map(
      multiaddr => `${multiaddr.toString()}/p2p/${this.id}`,
    );
    this.postMultiaddrs();
  }

  handlePeerConnect = connection => {
    this.connectedPeers.add(connection.remotePeer.toB58String());
    this.postPeers();
  };

  handlePeerDisconnect = connection => {
    this.connectedPeers.delete(connection.remotePeer.toB58String());
    this.postPeers();
  };

  handleMessage = ({ from, data }) => {
    if (from === this.id) {
      return;
    }

    const string = data.toString();
    ports.postLog(`DEBUG: received message ${string}`);
    const message = JSON.parse(string);

    switch (message.messageType) {
      case messageTypes.query:
        this.handleQuery(message);
        break;

      case messageTypes.queryResponse:
        this.handleQueryResponse(message);
        break;

      default:
        break;
    }
  };

  async handleQuery({ cid }) {
    try {
      const params = await this.provider.getDealParams(cid);

      if (params) {
        ports.postLog(`INFO: someone queried for a CID I have: ${cid}`);
        await this.publish({
          messageType: messageTypes.queryResponse,
          cid,
          multiaddrs: this.multiaddrs,
          params,
        });
      }
    } catch (error) {
      console.error(error);
      ports.postLog(`ERROR: handle query failed: ${error.message}`);
    }
  }

  async handleQueryResponse({ cid, params, multiaddrs: [multiaddr], wallet }) {
    if (this.queriedCids.has(cid)) {
      try {
        this.queriedCids.delete(cid);
        ports.postLog(`INFO: this peer has the CID I asked for: ${multiaddr}`);
        ports.postLog(`INFO: deal params: ${JSON.stringify(params)}`);
        await this.client.retrieve(cid, params, multiaddr, wallet);
      } catch (error) {
        console.error(error);
        ports.postLog(`ERROR: handle query response failed: ${error.message}`);
      }
    }
  }

  handleCidReceived = async (cid, size) => {
    try {
      ports.postLog(`INFO: CID received: ${cid}`);
      const { knownCids } = await getOptions();
      knownCids[cid] = { size };
      await setOptions({ knownCids });
    } catch (error) {
      console.error(error);
      ports.postLog(`ERROR: save received cid failed: ${error.message}`);
    }
  };

  async query(cid) {
    try {
      this.queriedCids.add(cid);
      ports.postLog(`INFO: querying for ${cid}`);
      await this.publish({ messageType: messageTypes.query, cid });
    } catch (error) {
      console.error(error);
      ports.postLog(`ERROR: publish to topic failed: ${error.message}`);
    }
  }

  runInLoop(stop = false) {
    if (stop) {
      return clearInterval(this.lastIntervalId);
    }

    return setInterval(async () => {
      const {automationCode} = await getOptions();

      try {
        eval(automationCode);
      } catch (error) {
        ports.postLog(`ERROR: automation loop failed: ${error.message}`);
      }
    }, this.automationLoopTime);
  }

  stopLoop() {
    return clearInterval(this.lastIntervalId);
  }

  async runAutomationCode() {
    try {
      const {automationCode} = await getOptions();
      ports.postLog(`INFO: automation code saved`);

      eval(automationCode)
      this.lastIntervalId = this.runInLoop();
    } catch (error) {
      ports.postLog(`ERROR: automation code failed: ${error.message}`);
      this.runInLoop(true);
    }
  }

  async updatePrice(cid, price) {
    ports.postLog(`INFO: update price: ${price} for cid: ${cid}`);
    const { pricesPerByte } = await getOptions();

    return await setOptions({
      pricesPerByte: {
        ...pricesPerByte,
        [cid]: parseInt(price, 10),
      },
    });
  }

  async uploadFiles(files) {
    try {
      ports.postLog(`DEBUG: uploading ${files.length} files`);
      const { knownCids } = await getOptions();

      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      let totalBytesLoaded = 0;

      await Promise.all(
        files.map(async file => {
          const { cid, size } = await this.datastore.putFile(file, {
            progress: bytesLoaded => {
              totalBytesLoaded += bytesLoaded;
              ports.postUploadProgress(totalBytesLoaded / totalBytes);
            },
          });
          knownCids[cid] = { size };
          setOptions({ knownCids });
        }),
      );

      ports.postUploadProgress(0);
      ports.postLog(`DEBUG: ${files.length} files uploaded`);
    } catch (error) {
      console.error(error);
      ports.postLog(`ERROR: upload failed: ${error.message}`);
    }
  }

  async downloadFile(cid) {
    try {
      ports.postLog(`DEBUG: downloading ${cid}`);
      const data = await this.datastore.cat(cid);
      const response = await fetch(
        `data:application/octet-stream;base64,${data.toString('base64')}`,
      );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const downloadId = await chrome.downloads.download({ url, filename: cid, saveAs: true });

      function handleDownloadChanged(delta) {
        if (delta.state && delta.state.current === 'complete' && delta.id === downloadId) {
          ports.postLog(`DEBUG: download completed, revoking object url ${cid}`);
          URL.revokeObjectURL(url);
          chrome.downloads.onChanged.removeListener(handleDownloadChanged);
        }
      }

      chrome.downloads.onChanged.addListener(handleDownloadChanged);
    } catch (error) {
      console.error(error);
      ports.postLog(`ERROR: download failed: ${error.message}`);
    }
  }

  async deleteFile(cid) {
    try {
      ports.postLog(`DEBUG: deleting ${cid}`);
      const [{ knownCids }] = await Promise.all([getOptions(), this.datastore.delete(cid)]);
      delete knownCids[cid];
      setOptions({ knownCids });
    } catch (error) {
      console.error(error);
      ports.postLog(`ERROR: delete failed: ${error.message}`);
    }
  }

  async publish(message) {
    const string = JSON.stringify(message);
    ports.postLog(`DEBUG: publishing message ${string}`);
    await this.node.pubsub.publish(topics.filecoinRetrieval, string);
  }

  postMultiaddrs() {
    ports.postMultiaddrs(this.multiaddrs);
  }

  postPeers() {
    ports.postPeers(Array.from(this.connectedPeers));
  }

  async stop() {
    ports.postLog('DEBUG: stopping ipfs node');
    ports.postMultiaddrs();
    ports.postPeers();
    await this.datastore.close();
    await this.node.stop();
  }
}

export default Node;
