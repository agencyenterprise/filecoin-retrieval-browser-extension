import React from 'react';
import classNames from 'classnames';
import QueryForm from './QueryForm';
import KnownCids from './KnownCids';
import Deals from './Deals';
import Offers from './Offers';

// temp
import Temp from './Temp'

function Home({ className, ...rest }) {
  return (
    <div className={classNames(className, 'p-4')} {...rest}>
      <QueryForm />
      <Offers className="mt-4" />
      <KnownCids className="mt-4" />
      <Deals className="mt-4" />
      <Temp />
    </div>
  );
}

export default Home;
