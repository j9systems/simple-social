self.addEventListener("push", function (event) {
  if (!event.data) return;

  var payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "Simple Social", body: event.data.text() };
  }

  var title = payload.title || "Simple Social";
  var options = {
    body: payload.body || "",
    icon:
      payload.icon ||
      "https://res.cloudinary.com/duy32f0q4/image/upload/v1772878441/simpleSocial_Logo_s9xbr8.png",
    badge: payload.badge || undefined,
    data: { url: payload.url || "/" },
    tag: payload.tag || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      }),
  );
});
