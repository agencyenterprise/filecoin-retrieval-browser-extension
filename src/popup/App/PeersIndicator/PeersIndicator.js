import React from 'react';
import classNames from 'classnames';
import usePort from 'src/popup/hooks/usePort';
import channels from 'src/shared/channels';
import Badge from 'src/popup/components/Badge';

function PeersIndicator({ className, ...rest }) {
  const peersState = usePort(channels.peers);

  return (
    <div
      className={classNames(className, 'relative mx-2')}
      title={
        peersState
          ? `Connected to:\n${peersState.join('\n') || 'no peer'}`
          : 'Not connected to any peers yet'
      }
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" {...rest}>
        <path d="M21 9c-1.656 0-3 1.343-3 3s1.344 3 3 3 3-1.343 3-3-1.344-3-3-3zm-15 9c-1.657 0-3 1.343-3 3s1.343 3 3 3c1.656 0 3-1.343 3-3s-1.344-3-3-3zm3-15c0 1.657-1.344 3-3 3s-3-1.343-3-3 1.344-3 3-3 3 1.343 3 3zm1.588-1.979l.412-.021c4.281 0 7.981 2.45 9.8 6.021-.717.029-1.39.21-1.998.511-1.555-2.703-4.466-4.532-7.802-4.532 0-.703-.149-1.372-.412-1.979zm10.212 15.958c-1.819 3.571-5.519 6.021-9.8 6.021l-.412-.021c.263-.607.412-1.276.412-1.979 3.336 0 6.247-1.829 7.802-4.532.608.302 1.281.483 1.998.511zm-18.91 1.186c-1.193-1.759-1.89-3.88-1.89-6.165s.697-4.406 1.89-6.165c.392.566.901 1.039 1.487 1.403-.867 1.383-1.377 3.012-1.377 4.762s.51 3.379 1.377 4.762c-.586.364-1.096.837-1.487 1.403z" />
      </svg>
      {peersState && <Badge>{peersState.length}</Badge>}
    </div>
  );
}

export default PeersIndicator;
