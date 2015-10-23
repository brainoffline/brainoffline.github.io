'use strict';
(function ($) {
    var cc = {
        video: null,
        $player: null,
        init: function (v) {
            this.$player = v;
            this.video = v.find('video')[0];

            cc.playbackEvents.init();
            cc.castEvents.init();
        }
    };

    $(window).on('load', function () {
        cc.init($('#player'));
    });

    window.cc = cc;
})(window.$);
