$(document).ready(function onDocReady() {
  console.log("app loaded");
  console.log("doc.cookie is " + document.cookie);

  // fetch visits
  /*
  $.getJSON('/v1/visits', function(data) {
    var container = $('<ol></ol>');
    console.log('json fetched');
    data.forEach(function(item) {
      container.append('<li>' + '"' + item.title + '" ' + item.url + '</li>');
    });
    $('body').append(container);
  });
  */

  $('.login').click(function(e) {
    var clientId = '1f9bbddcb3e160ab';
    // TODO is this the right dev server? it's 404ing.
    var relierClient = new FxaRelierClient(clientId, {
      fxaHost: 'https://latest.dev.lcip.org'
    });
    relierClient.auth['signIn']({
      ui: 'redirect',
      // state: document.cookie['sid-chronicle'] || '', // TODO what's the cookie? 'sid'?
      state: 'whatever',
      scope: 'chronicle profile',
      redirect_uri: 'http://localhost:8080/auth/complete'
    });
  });
});
