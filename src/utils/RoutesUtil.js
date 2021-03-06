import _ from 'lodash';
import Cookies from 'js-cookie';
import localStorage from 'local-storage-fallback';
import URI from 'urijs';

import auth from '../apps/Account/auth';
import NewLibConnection from '../apps/Session/NewLibConnection';

import SessionStore from '../apps/Session/SessionStore';

const RoutesUtil = {
  checkActiveSubscriptions(nextState, replace, callback) {
    const connection = NewLibConnection.get();
    const token = localStorage.getItem('token');

    if (token) {
      connection.setAccountKey(token);
    }

    connection
      .Profile
      .please()
      .get()
      .then(({ status }) => {
        const redirectRoute = {
          no_active_subscription: '/expired/',
          free_limits_exceeded: '/free-limits-exceeded/',
          hard_limit_reached: '/hard-limits-reached/',
          overdue_invoices: '/failed-payment/'
        }[status];

        redirectRoute && replace(redirectRoute);
        callback();
      });
  },

  isInstanceAvailable(instanceName) {
    const connection = NewLibConnection.get();

    return connection
      .Instance
      .please()
      .get({ name: instanceName });
  },

  onAppEnter(nextState, replace) {
    const uri = new URI();
    const originalUri = uri.normalize().toString();
    let pathname = decodeURIComponent(nextState.location.pathname).replace('//', '/');
    const query = _.extend({}, uri.search(true), nextState.location.query);

    SessionStore.setUTMData(nextState.location.query);

    // remove trailing slash
    if (pathname.length > 1 && pathname.match('/$') !== null) {
      pathname = pathname.slice(0, -1);
    }

    uri.search(query);
    uri.hash(`${pathname}${uri.search()}`);
    uri.search('');

    const normalizedUri = uri.normalize().toString();

    if (originalUri !== normalizedUri) {
      location.href = normalizedUri;
      return null;
    }

    let name = 'app';
    const names = nextState.routes.map((route) => route.name).filter((routeName) => typeof routeName !== 'undefined');

    if (names.length > 0) {
      name = names[names.length - 1];
    }

    if (name === 'login' || name === 'signup') {
      window.analytics.page(`Dashboard ${_.capitalize(name)}`, {
        path: nextState.location.pathname
      });
    } else {
      window.analytics.page('Dashboard', {
        Page: name,
        path: nextState.location.pathname,
        category: 'Dashboard',
        label: name
      });
    }

    if (auth.loggedIn() && nextState.location.pathname === '/' && !query.token) {
      return this.redirectToLastPathname(nextState, replace);
    }

    return null;
  },

  onDashboardChange(prevState, nextState, replace) {
    localStorage.setItem('lastPathname', nextState.location.pathname);

    if (nextState.location.pathname === '/') {
      this.redirectToLastInstance(nextState, replace);
    }
  },

  onDashboardEnter(nextState, replace) {
    const { signUpMode } = nextState.location.query;

    if (!auth.loggedIn() && !signUpMode) {
      return this.redirectToLogin(nextState, replace);
    }

    return null;
  },

  redirectToDashboard(nextState, replace) {
    if (auth.loggedIn()) {
      replace({ pathname: '/' });
    }
  },

  redirectToLastInstance(nextState, replace) {
    const lastInstanceName = localStorage.getItem('lastInstanceName');

    if (lastInstanceName) {
      this.isInstanceAvailable(lastInstanceName)
        .then(replace({ pathname: `/instances/${lastInstanceName}/sockets/` }));
    }
  },

  redirectToLastPathname(nextState, replace) {
    const lastPathname = localStorage.getItem('lastPathname');

    if (lastPathname && lastPathname !== '/') {
      return replace({ pathname: lastPathname });
    }

    return null;
  },

  redirectToLogin(nextState, replace) {
    const query = _.omit(nextState.location.query, 'next');

    if (nextState.location.query.next) {
      return replace({
        name: 'login',
        state: { nextPathname: nextState.location.pathname },
        query: _.merge({ next: nextState.location.pathname }, query)
      });
    }

    Cookies.remove('logged_in', { domain: SYNCANO_BASE_DOMAIN });

    return replace({ name: 'login', query: _.merge({ next: nextState.location.pathname }, query) });
  }
};

export default RoutesUtil;
