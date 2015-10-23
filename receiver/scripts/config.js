'use strict';
(function (cc) {

    cc.config = {};
    cc.config.timeOutSeconds = {
        //these correlate to normal states
        idle: 5 * 60,
        mediaLoading: 60,
        startBuffering: 2,
        stillBuffering: 3,
        extendBuffering: 30,
        paused: 5,
        stillPaused: 20*60,
        playing:5,
        error: 5*60
    };
    cc.config.deliveryCapabilityIds ={
        'HD': 331,
        'SD': 330
    };
    cc.config.resources = {
        loadingIcon: './image/loading.gif',
        bufferingIcon: './image/loading.gif',
        backgroundImage: './image/background.png',
        pauseIcon: './image/paused.png',
        playIcon: './image/playing.png',
        logo: './image/logo.png'
    };
}(window.cc));
