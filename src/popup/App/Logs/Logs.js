/* global chrome */

import React, { useRef, useEffect } from 'react';
import classNames from 'classnames';
import Card from 'src/popup/components/Card';
import Label from 'src/popup/components/Label';
import IconButton from 'src/popup/components/IconButton';
import Pre from 'src/popup/components/Pre';
import usePort from 'src/popup/hooks/usePort';
import channels from 'src/shared/channels';
import messageTypes from 'src/shared/messageTypes';
import './Logs.css';

function Logs({ className, ...rest }) {
  const preRef = useRef();
  const firstRenderWithLogsRef = useRef(true);
  const logs = usePort(channels.logs);

  useEffect(() => {
    if (firstRenderWithLogsRef.current) {
      firstRenderWithLogsRef.current = !logs;
      preRef.current.scrollTop = preRef.current.scrollHeight;
    } else {
      preRef.current.scrollTo({ top: preRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [logs]);

  // TEMP - Remove once wasm integrated
  function mikeTemporaryTrigger() {
    console.log("Hello, Mike!");
    chrome.runtime.sendMessage({ messageType: messageTypes.mikeMessage });
  }
  //////// end - remove ////////

  function sendClearLogsMessage() {
    chrome.runtime.sendMessage({ messageType: messageTypes.clearLogs });
  }

  return (
    <div className={classNames(className, 'p-4')} {...rest}>
      <Card className="p-4">
        <div className="flex">
          <Label className="flex-1 mb-2">Logs</Label>
          <IconButton icon="trash" onClick={sendClearLogsMessage} />
        </div>
        <div className="flex">
	  <IconButton icon="success" onClick={mikeTemporaryTrigger} />
        </div>
        <Pre ref={preRef} className="Logs--pre">
          {logs ? logs.join('\n') : ' '}
        </Pre>
      </Card>
    </div>
  );
}

export default Logs;
