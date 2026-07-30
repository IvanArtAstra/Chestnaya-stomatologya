/* Бейдж «Открыто до 20:00» отключён по требованию клиента.
   Файл оставлен пустым, чтобы не править <script>-подключения на страницах. */
(function () {
  "use strict";
  var b = document.getElementById("openBadge");
  if (b && b.parentNode) b.parentNode.removeChild(b);
})();
