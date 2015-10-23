'use strict';
(function (cc, svc) {
    cc.controller = {lastState: 'unknown'};
    cc.controller.internal = {
        timeout: 0,
        progressTimeout: 0
    };

    cc.controller.setState = function (state) {
        console.log('controller.setState ' + state, arguments);
        if(state === cc.controller.lastState) {
            return;
        }
        cc.controller.lastState = state;

        var messageData = {};

        if (cc.controller.internal.timeout) {
            console.info('it ended up clearing the timeout', cc.controller.internal.timeout);
            window.clearTimeout(cc.controller.internal.timeout);
            cc.controller.internal.timeout = 0;
        }
        var fn = function () {
        };
        switch (state) {
            case 'appLoading':
                showAppLoading();
                break;
            case 'mediaLoading':
                showBuffering();
                showMediaInfo();
                //kick off the initial timer for updating progress
                cc.controller.internal.progressTimeout = setTimeout(function () {
                    cc.controller.updateContentProgress();
                }, 150000);
                fn = function () {
                    cc.controller.setState('extendBuffering');
                };
                break;
            case 'paused':
                hidePlay();
                showPause();
                showMediaInfo();
                showScrubber();
                cc.controller.updateContentProgress();
                fn = function () {
                    cc.controller.setState('stillPaused');
                };
                break;
            case 'stillPaused':
                hideMediaInfo();
                hideScrubber();
                fn = function () {
                    cc.castEvents.resetMediaElement(cast.receiver.media.IdleReason.CANCELLED); //notify senders we are idle
                    window.close();
                };
                break;
            case 'idle':
                showReadyToCast();
                cc.castEvents.unloadVideo(); //this will call updateContentProgress and kill the stream
                fn = function () {
                    window.close();
                };
                break;
            case 'startBuffering':
                fn = function () {
                    cc.controller.setState('stillBuffering');
                };
                break;
            case 'stillBuffering':
                showBuffering();
                fn = function () {
                    cc.controller.setState('extendBuffering');
                };
                break;
            case 'extendBuffering':
                showMediaInfo();
                fn = function () {
                    cc.controller.setState('error', cc.resources.current.errorSources.video, 200);
                };
                break;
            case 'error':
                clearTimeout(cc.controller.internal.progressTimeout);

                var source = arguments[1] || { name: 'unknown', errorCodes: {}};
                if (!source.errorCodes && !$.isPlainObject(source.errorCodes)) {
                    source.errorCodes = {};
                }
                var code = arguments[2];
                var data = arguments[3] || { };
                var message = source.errorCodes[code] || source.errorCodes.unknown;

                showError(message);
                messageData.errorInfo = {
                    source: source.name,
                    code: code,
                    message: message,
                    data: data
                };
                messageData.controllerState = state;

                cc.castEvents.resetMediaElement(cast.receiver.media.IdleReason.ERROR, messageData); //notify senders we are idle
                cc.castEvents.unloadVideo(true, !lastUpdateSucceeded);
                fn = function () {
                    window.close();
                };
                break;
            case 'playing':
                showVideo();
                hidePause();
                showPlay();
                showMediaInfo();
                showScrubber();
                fn = function () {
                    hidePlay();
                    hideMediaInfo();
                    hideScrubber();
                };
                break;
        }

        var timeInSeconds = (parseInt(cc.config.timeOutSeconds[state], 10) || 0.1);
        console.info(timeInSeconds + ' seconds until ', fn);
        cc.controller.internal.timeout = setTimeout(function () {
            console.info('it ended up running after ' + timeInSeconds, cc.controller.internal.timeout);
            cc.controller.internal.timeout = 0;
            fn.call(cc.controller);
        }, timeInSeconds * 1000);
    };

    var lastUpdateSucceeded = true;
    cc.controller.updateContentProgress = function (complete) {
        if(cc.mediaInfo.video.preview === true){
            return;
        }

        clearTimeout(cc.controller.internal.progressTimeout);

        if (!cc.mediaInfo || !cc.mediaInfo.video || !cc.video || !cc.video.currentTime) {
            console.info('controller.updateContentProgress skipped because media was unloaded');
            return;
        }

        var mediaConsideredEnd = (cc.video.currentTime / cc.video.duration) > 0.95;
        console.info('controller.updateContentProgress called. mediaConsideredEnd:', mediaConsideredEnd, ' complete:', complete);

        var updateContentProgressRequest ={
            ViewingComplete: complete,
            StreamingComplete: mediaConsideredEnd,
            ProgressSeconds: parseInt(cc.video.currentTime || 0, 10),
            ProductId: cc.mediaInfo.video.productId,
            PricingPlanId: cc.mediaInfo.video.pricingPlanId

        };

        if(window.currentVideo){
            window.currentVideo.setCurrentTime(cc.mediaInfo.video.productId, cc.video.currentTime);
        }

        svc.subscriber.content.updateContentProgress(updateContentProgressRequest)
            .done(function () {
                lastUpdateSucceeded = true;
                if (mediaConsideredEnd === true || complete === true) {
                    console.info('update content progress succeeded.  media had ended.');
                } else {
                    console.info('update content progress succeeded at ' + updateContentProgressRequest.ProgressSeconds + ' seconds.  next call in 2.5 min.');
                    cc.controller.internal.progressTimeout = setTimeout(function () {
                        cc.controller.updateContentProgress();
                    }, 150000);
                }
            })
            .fail(function (fault) {
                lastUpdateSucceeded = false;

                console.warn('update content progress erred.  Retrying in 1 min.');
                cc.controller.internal.progressTimeout = setTimeout(function () {
                    cc.controller.updateContentProgress(complete);
                }, 60000);
                cc.castEvents.sendErrorMessage({
                    type:'updateContentProgressFault',
                    errorInfo: {
                        source: cc.resources.current.errorSources.api.name,
                        code: fault.Code,
                        message: cc.resources.current.errorSources.api.errorCodes[fault.Code],
                        data: fault
                    }
                });
            });
    };

    function showAppLoading() {
        cc.$player
            .trigger('showAppLoadingState');
    }

    function showBuffering() {
        cc.$player
            .trigger('showReadyToCast', false)
            .trigger('showErrorMessage', false)
            .trigger('showAppLoadingState', false)
            .trigger('play', false)
            .trigger('showBufferingState');
    }

    function showMediaInfo() {
        cc.$player
            .trigger('showReadyToCast', false)
            .trigger('showErrorMessage', false)
            .trigger('showAppLoadingState', false)
            .trigger('showMediaInfo');
    }

    function hideMediaInfo() {
        cc.$player
            .trigger('showMediaInfo', false);
    }

    function showScrubber() {
        cc.$player
            .trigger('showReadyToCast', false)
            .trigger('showErrorMessage', false)
            .trigger('showAppLoadingState', false)
            .trigger('showScrubber');
    }

    function hideScrubber() {
        cc.$player
            .trigger('showScrubber', false);
    }

    function showPause() {
        cc.$player
            .trigger('showBufferingState', false)
            .trigger('play', false)
            .trigger('pause');
    }

    function hidePause() {
        cc.$player
            .trigger('pause', false);
    }

    function showPlay() {
        cc.$player
            .trigger('play');
    }

    function hidePlay() {
        cc.$player
            .trigger('play', false);
    }

    function showReadyToCast() {
        hideEverything().trigger('showReadyToCast');
    }

    function showError(message) {
        hideEverything().trigger('showErrorMessage', [message]);
    }

    function hideEverything(){
        return cc.$player
            .trigger('showReadyToCast', false)
            .trigger('showMediaInfo', false)
            .trigger('showScrubber', false)
            .trigger('showAppLoadingState', false)
            .trigger('showBufferingState', false)
            .trigger('pause', false)
            .trigger('play', false)
            .trigger('showVideo', false);
    }

    function showVideo() {
        cc.$player.trigger('showVideo').trigger('showBufferingState', false);
    }

})(window.cc, window.ascendon.service);
