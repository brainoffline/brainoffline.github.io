'use strict';
(function (cc, $) {
    cc.urlValidator = {
        validate: function (url) {
            return $.ajax({
                url: url,
                type: 'GET'
            });
        }
    };
})(window.cc, window.jQuery);
