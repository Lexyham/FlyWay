

const AdminState = (() => {
  
  let _state = {
    users:        [],
    bookings:     [],
    transactions: [],
    messages:     [],
    promos:       [],
    licenses:     [],
    uploads:      [],
    logs:         [],
    stats:        null,
    loading:      false,
    currentTab:   'overview',
  };

  
  const _listeners = {};

  function subscribe(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
    return () => {
      _listeners[event] = _listeners[event].filter(f => f !== fn);
    };
  }

  function _emit(event, payload) {
    (_listeners[event] || []).forEach(fn => fn(payload));
    (_listeners['*'] || []).forEach(fn => fn({ event, payload }));
  }

  

  
  function getState() {
    return { ..._state };
  }

  
  function get(key) {
    return _state[key];
  }

  
  function setState(patch) {
    const changed = [];
    for (const [key, value] of Object.entries(patch)) {
      if (_state[key] !== value) {
        _state[key] = value;
        changed.push(key);
      }
    }
    changed.forEach(key => _emit(key, _state[key]));
    if (changed.length) _emit('change', { keys: changed, state: _state });
  }

  

  function setLoading(val) {
    setState({ loading: val });
    _emit('loading', val);
  }

  function setTab(tab) {
    setState({ currentTab: tab });
  }

  

  
  function updateItem(sliceKey, id, patch) {
    const arr = (_state[sliceKey] || []).map(item =>
      item.id === id ? { ...item, ...patch } : item
    );
    setState({ [sliceKey]: arr });
  }

  
  function removeItem(sliceKey, id) {
    const arr = (_state[sliceKey] || []).filter(item => item.id !== id);
    setState({ [sliceKey]: arr });
  }

  
  function addItem(sliceKey, item) {
    const arr = [item, ...(_state[sliceKey] || [])];
    setState({ [sliceKey]: arr });
  }

  
  function reset() {
    _state = {
      users: [], bookings: [], transactions: [], messages: [],
      promos: [], licenses: [], uploads: [], logs: [],
      stats: null, loading: false, currentTab: 'overview',
    };
    Object.keys(_listeners).forEach(k => { _listeners[k] = []; });
  }

  return {
    getState, get, setState, setLoading, setTab,
    updateItem, removeItem, addItem,
    subscribe, reset,
  };
})();


window.AdminState = AdminState;
