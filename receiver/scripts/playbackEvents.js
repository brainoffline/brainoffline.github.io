'use strict';
(function (cc, $) {

    cc.playbackEvents = {};

    cc.playbackEvents.init = function () {
        //ON INIT
        $('<div />').addClass('media-title-background').hide().appendTo(cc.$player);
        var $mediaImage = $('<img />').addClass('media-image').hide().appendTo(cc.$player);
        var $mediaTitle = $('<div />').addClass('media-title').hide().appendTo(cc.$player);
        var $logo = $('<img />').addClass('logo').hide().attr('src', cc.config.resources.logo).appendTo(cc.$player);
        var $play = $('<img/>').addClass('play').hide().attr('src', cc.config.resources.playIcon).appendTo(cc.$player);
        var $mediaElements = $('div.media-title, img.media-image, div.media-title-background, img.logo', cc.$player);
        var $castMsg = $('<div/>').addClass('message cast-message').html(cc.resources.default.readyMessage).hide().appendTo(cc.$player);
        var $errorMsg = $('<div/>').addClass('message error-message').hide().appendTo(cc.$player);
        var $pause = $('<div/>').addClass('pause').append($('<img/>').attr('src', cc.config.resources.pauseIcon)).hide().appendTo(cc.$player);
        var $loading = $('div.loading', cc.$player).hide();
        var $buffering = $('<div/>').addClass('buffering').append($('<img/>').attr('src', cc.config.resources.bufferingIcon)).hide().appendTo(cc.$player);
        var $video = $('div.video-wrapper', cc.$player);
        var $scrubber = $('<div/>').addClass('scubber')
            .append($('<span/>').addClass('full'))
            .append($('<span/>').addClass('current'))
            .append($('<div/>').addClass('time')
                .append($('<span/>').addClass('remaining').html('00:00:00'))
                .append(' / ')
                .append($('<span/>').addClass('duration').html('00:00:00'))
        )
            .append($('<div/>').addClass('elapsed')
                .append($('<span/>').addClass('elapsed').html('00:00:00'))
        ).hide().appendTo(cc.$player);


        //PLAYER EVENTS

        cc.$player
            .on('showLogo', function (evt, visibile) {
                $logo[visibile !== false ? 'fadeIn' : 'fadeOut']('fast');
            })
            .on('showAppLoadingState', function (evt, visible) {
                $loading[visible !== false ? 'show' : 'hide']();
            })
            .on('showBufferingState', function (evt, visible) {
                $buffering[visible !== false ? 'show' : 'hide']();
            })
            .on('pause', function (evt, visible) {
                $pause[visible !== false ? 'fadeIn' : 'fadeOut']('fast');
            })
            .on('play', function (evt, visible) {
                $play[visible !== false ? 'fadeIn' : 'fadeOut']('fast');
            })
            .on('showVideo', function (evt, visible) {
                $video[visible !== false ? 'fadeIn' : 'fadeOut']('fast');
            })
            .on('showReadyToCast', function (evt, visible) {
                $castMsg[visible !== false ? 'fadeIn' : 'fadeOut']('fast');
            })
            .on('showScrubber', function (evt, visible) {
                if (visible !== false) {
                    updateScrubber.apply(this, [function () {
                        $scrubber.fadeIn('fast');
                    }]);
                }
                else {
                    $scrubber.fadeOut('fast');
                }
            })
            .on('showMediaInfo', function (evt, visible) {
                if (cc.mediaInfo && cc.mediaInfo.video) {
                    $mediaImage.attr('src', cc.mediaInfo.video.thumbnailUrl);
                    $mediaTitle.html(cc.mediaInfo.video.title);
                }
                $mediaElements[visible !== false ? 'fadeIn' : 'fadeOut']('fast');
            })
            .on('showErrorMessage', function (evt, message) {
                if (message !== false) {
                    $errorMsg.append($('<span/>').html(message)).fadeIn('fast');
                } else {
                    $errorMsg.fadeOut('fast', function () {
                        $(this).empty();
                    });
                }
            });

        var scrubberWidth = 0;

        var updateScrubber = function (fn) {
            if (scrubberWidth === 0) {
                scrubberWidth = $('span.full', $scrubber).width();
            }
            var width = (scrubberWidth * cc.video.currentTime / cc.video.duration) || 0;
            var remaining = (cc.video.duration - cc.video.currentTime) || 0;
            $('span.elapsed', $scrubber).html((cc.video.currentTime || 0).toHHMMSS());
            $('span.duration', $scrubber).html((cc.video.duration || 0).toHHMMSS());
            $('span.remaining', $scrubber).html((remaining || 0).toHHMMSS());
            $('span.current', $scrubber).css('width', width + 'px');
            if (fn && $.isFunction(fn)) {
                fn.apply(this);
            }
        };

        //VIDEO EVENTS
        $(cc.video)
            .on('playing', function () {
                console.info('video-playing');
                cc.controller.setState('playing');
            })
            .on('play', function () {
                console.info('video-play');
                cc.controller.setState('playing');
            })
            .on('ended', function () {
                console.info('video-ended');
                cc.controller.setState('idle');
            })
            .on('pause', function () {
                console.info('video-pause', arguments);
                var isIdle = cc.controller.lastState === 'idle';
                var isDone = cc.video.currentTime === cc.video.duration;
                if (cc.castEvents.isUnderflow()) {
                    console.log('isUnderflow');
                    cc.controller.setState('startBuffering');
                    cc.castEvents.broadCastStatus();
                } else if (!isIdle && !isDone) {
                    cc.controller.setState('paused');
                }
            })
            .on('seeked', function () {
                console.info('video-seeked');
                cc.controller.setState('playing');
            })
            .on('waiting', function () {
                console.info('video-waiting');
                cc.controller.setState('startBuffering');
            })
            .on('loadeddata', function () {
                console.info('video-loaded');
                this.play();
            })
            .on('error', function () {
                console.error('video-error', arguments);
                cc.controller.setState('error', cc.resources.current.errorSources.video, 100, {});
            })
            .on('timeupdate', function () {
                updateScrubber.apply(this);
            });


    };

    cc.playbackEvents.preLoad = function () {
        $('body').css('background-image', 'url(\'' + cc.config.resources.backgroundImage + '\')');
        $('#player')
            .append($('<div/>').addClass('loading').append($('<img/>').attr('src', cc.config.resources.loadingIcon)));
    };
})(window.cc, window.jQuery);
