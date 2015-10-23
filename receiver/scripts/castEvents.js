'use strict';
(function (cc, cast, $, svc) {

    cc.castEvents = {};

    cc.castEvents.init = function () {
        var mediaManager = new cast.receiver.MediaManager(cc.video);
        var receiverManager = cast.receiver.CastReceiverManager.getInstance();
        var messageBus = receiverManager.getCastMessageBus('urn:x-cast:com.cd');
        var mediaPlayer = null;
        var mediaHost = null;
        var config = new cast.receiver.CastReceiverManager.Config();

        var getDCID = function(){
            var result;

            if (cc.mediaInfo.quality === 'HD') {
                result = cc.config.deliveryCapabilityIds.HD;
            } else {
                result = cc.config.deliveryCapabilityIds.SD;
            }

            if (cc.mediaInfo.deliveryCapabilityId) {
                result = parseInt(cc.mediaInfo.deliveryCapabilityId, 10) || result;
            }

            return result;
        };

        var viewContentTypes = {
            video: 0,
            preview: 1,
            relatedMedia: 2
        };

        receiverManager.onReady = function (evt) {
            console.info('receiverManager.onReady', evt);
            cc.controller.setState('idle');
        };

        receiverManager.onSenderDisconnected = function (evt) {
            console.info('receiverManager.onSenderDisconnected', evt);
            console.info('remaining senders: ' + receiverManager.getSenders().length);
            console.info('disconnect reason: ' + evt.reason);
            if (receiverManager.getSenders().length === 0 &&
                evt.reason === cast.receiver.system.DisconnectReason.REQUESTED_BY_SENDER) {
                cc.castEvents.unloadVideo();
                console.warn('last sender just disconnected so now closing. reason:', evt.reason);
                window.close();
            }
        };

        receiverManager.onSenderConnected = function (evt) {
            console.info('receiverManager.onSenderConnected', evt);
            if (evt.type === 'senderdisconnected' && evt.reason === cast.receiver.system.DisconnectReason.REQUESTED_BY_SENDER && receiverManager.getSenders().length === 0) {
                console.warn('last sender just disconnected so now closing. reason:', evt.reason);
                window.close();
            }
        };

        receiverManager.onSeek = function (evt) {
            console.info('receiverManager.onSeek', evt);
            cc.controller.setState('playing');
        };

        var originalStop = mediaManager.onStop;
        mediaManager.onStop = function (evt) {
            console.log('mediaManager.onStop', evt);
            if (originalStop && $.isFunction(originalStop)) {
                originalStop.call(mediaManager, evt);
            }
            cc.controller.setState('idle'); //this will trigger unload video
        };

        var textTrackType = null;
        var origOnEditTracksInfo = mediaManager.onEditTracksInfo;
        mediaManager.onEditTracksInfo = function (e) {
            console.info('onEditTracksInfo', e, JSON.stringify(e));
            if (origOnEditTracksInfo && $.isFunction(origOnEditTracksInfo)) {
                origOnEditTracksInfo.call(mediaManager, e);
            }

            var media = mediaManager.getMediaInformation();
            if (e && e.data && e.data.activeTrackIds && e.data.activeTrackIds.length) {
                var textTrackToActivate = null;
                var audioToActivate = null;
                for (var i = 0, ln = e.data.activeTrackIds.length; i < ln; i++) {
                    var track = media.tracks[e.data.activeTrackIds[i]];
                    if (track) {
                        if (track.type === cast.receiver.media.TrackType.TEXT) {
                            textTrackToActivate = track;
                        } else if (track.type === cast.receiver.media.TrackType.AUDIO) {
                            audioToActivate = track;
                        }
                    }
                }

                disableTextTracks();

                if (textTrackToActivate) {
                    if (textTrackToActivate.customData.location === 'sideloaded') {
                        mediaPlayer.enableCaptions(true, textTrackToActivate.customData.type, textTrackToActivate.trackContentId);
                        textTrackType = textTrackToActivate.customData.type;

                    } else if (textTrackToActivate.customData.location === 'embedded') {
                        enableEmbeddedTrack('text', textTrackToActivate.trackId, function () {
                            mediaPlayer.enableCaptions(true);
                        });
                    }
                }

                if (audioToActivate && !cc.protocol.isStreamEnabled(audioToActivate.trackId)) {
                    if (mediaHost && mediaHost.licenseCustomData) {
                        var validateEntitlementsRequest = {
                            DeliveryCapabilityId: getDCID(),
                            RetrieveLicenseToken: true,
                            Entitlements: [
                                {
                                    ProductId: cc.mediaInfo.video.productId,
                                    PricingPlanId: cc.mediaInfo.video.pricingPlanId
                                }
                            ]
                        };

                        svc.subscriber.content.validateEntitlements(validateEntitlementsRequest).done(function (result) {
                            mediaHost.licenseCustomData = result.ValidEntitlements[0].LicenseRequestToken;
                            enableEmbeddedTrack('audio', audioToActivate.trackId, function () {
                                mediaPlayer.reload();
                            });
                        })
                            .fail(function (fault ) {
                                console.warn('Unable to get license.');

                                cc.castEvents.sendErrorMessage({
                                    type: 'unableToRenewLicense',
                                    errorInfo: {
                                        source: cc.resources.current.errorSources.api.name,
                                        code: fault.Code,
                                        message: cc.resources.current.errorSources.api.errorCodes[fault.Code],
                                        data: fault
                                    }
                                });
                            });
                    } else {
                        enableEmbeddedTrack('audio', audioToActivate.trackId, function () {
                            mediaPlayer.reload();
                        });
                    }
                }
            } else {
                disableTextTracks();
            }
        };

        var origOnMetaDataLoaded = mediaManager.onMetadataLoaded;
        mediaManager.onMetadataLoaded = function (e) {
            if (!cc.protocol) {
                origOnMetaDataLoaded.call(mediaManager, e);
                return;
            }

            console.info('metadataLoaded:begin', e);
            //audio video internal
            e.message.media.tracks = getEmbeddedTracksToMediaInfo(cc.protocol);
            var video = null;
            var audio = null;
            var languageAudio = null;
            var activeTracks = [];

            for (var ln = 0; ln < e.message.media.tracks.length; ln++) {
                var currentTrack = e.message.media.tracks[ln];
                if (video === null && currentTrack.type === cast.receiver.media.TrackType.VIDEO) {
                    video = currentTrack;
                }
                if (audio === null && currentTrack.type === cast.receiver.media.TrackType.AUDIO) {
                    audio = currentTrack;
                }

                if (languageAudio === null && currentTrack.type === cast.receiver.media.TrackType.AUDIO && cc.mediaInfo.defaultLanguage && cc.mediaInfo.defaultLanguage === currentTrack.language) {
                    console.log('found matching audio language: ' + cc.mediaInfo.defaultLanguage);
                    languageAudio = currentTrack;
                }
            }

            if (video !== null) {
                e.message.media.contentType = video.trackContentType;
                activeTracks.push(video.trackId);
            }

            if (languageAudio !== null) {
                activeTracks.push(languageAudio.trackId);
            }
            else if (audio !== null) {
                activeTracks.push(audio.trackId);
            }

            e.message.media.duration = cc.video.duration;

            mediaManager.setMediaInformation(e.message.media, true);

            var tracksInfo = new cast.receiver.media.TracksInfo();
            tracksInfo.activeTrackIds = activeTracks;
            tracksInfo.tracks = e.message.media.tracks;
            tracksInfo.textTrackStyle = e.message.media.textTrackStyle;

            mediaManager.loadTracksInfo(tracksInfo);

            //Load the external text tracks if they exist
            svc.metadata.media(e.message.customData.mediaId).done(function (metaDataResponse) {
                var trackLength = e.message.media.tracks.length,
                    sideloadedCaptions = [],
                    sideloadedTrack = {},
                    i = 0;

                if(metaDataResponse && metaDataResponse.Media) {
                    var sideloadedClosedCaptions = (metaDataResponse.Media.ClosedCaptions && 'ClosedCaptionSettings' in metaDataResponse.Media.ClosedCaptions) ? metaDataResponse.Media.ClosedCaptions.ClosedCaptionSettings : null,
                        sideloadedMarkers = metaDataResponse.Media.Markers || null;

                    // Check for sideloaded captions from closed captions first, then from markers
                    if (sideloadedClosedCaptions && sideloadedClosedCaptions.length > 0) {
                        for (i = 0; i < sideloadedClosedCaptions.length; i += 1) {
                            sideloadedCaptions.push({
                                language: sideloadedClosedCaptions[i].Language,
                                url: sideloadedClosedCaptions[i].Url
                            });
                        }
                    } else if (sideloadedMarkers && sideloadedMarkers.length > 0) {
                        for (i = 0; i < sideloadedMarkers.length; i += 1) {
                            var externalConfiguration = sideloadedMarkers[i].ExternalConfiguration;
                            if (externalConfiguration && externalConfiguration.ExternalTypeCode === 4) {
                                for (var fi in externalConfiguration.Fields) {
                                    var field = externalConfiguration.Fields[fi];
                                    if (field.ExternalTypeFieldCode === 21) {
                                        sideloadedCaptions.push({
                                            language: 'caption_' + String(i + 1),
                                            url: field.FieldValue
                                        });
                                    }
                                }
                            }
                        }
                    }

                    $.each(sideloadedCaptions, function (i, val) {
                        sideloadedTrack = createSideloadedTrack(i, val, trackLength);
                        e.message.media.tracks.push(sideloadedTrack);
                    });
                }

                mediaManager.setMediaInformation(e.message.media, true);
                mediaManager.loadTracksInfo(tracksInfo);

                //switching audio tracks earlier in onMetadataLoaded will work, but will throw javascript errors.
                if (languageAudio !== null && languageAudio.trackId !== audio.trackId) {
                    enableEmbeddedTrack('audio', languageAudio.trackId, function () {
                        mediaPlayer.reload();
                    });
                }

                mediaManager.sendLoadComplete();
                console.info('metadataLoaded:done-success', e);
            })
            .fail(function () {
                mediaManager.sendLoadComplete();
                console.info('metadataLoaded:done-fail', e, arguments);
            });
        };

        var originalError = mediaManager.onLoadMetadataError;
        mediaManager.onLoadMetadataError = function (e) {
            console.error('metadataError', e);
            if (originalError && $.isFunction(originalError)) {
                originalError.call(mediaManager, e);
            }
        };

        var origMediaManagerOnLoad = mediaManager.onLoad;
        mediaManager.onLoad = function (evt) {
            console.info('mediaManager.onLoad', evt);
            // unload the video if one was already playing: https://developers.google.com/cast/docs/player
            cc.castEvents.unloadVideo();
            var requestedLanguage;
            if(evt && evt.data && evt.data.media && evt.data.media.customData && evt.data.media.customData.defaultUILanguage) {
                requestedLanguage = evt.data.media.customData.defaultUILanguage;
            }
            if(requestedLanguage && cc.resources[requestedLanguage]) {
                cc.resources.current = cc.resources[requestedLanguage];
            }
            else {
                cc.resources.current = cc.resources.default;
            }
            cc.mediaInfo = evt.data.media.customData;

            svc.settings.configure(
                {
                    systemId: cc.mediaInfo.settings.systemId,
                    channelId: cc.mediaInfo.settings.channelId,
                    apiUrl: cc.mediaInfo.settings.apiUrl,
                    deviceType: cc.mediaInfo.settings.deviceType,
                    language: cc.mediaInfo.settings.language,
                    domain: ''
                }
            );

            svc.settings.sessionId = cc.mediaInfo.sessionId;

            cc.controller.setState('mediaLoading');

            var viewContentRequest = {
                ProductId: cc.mediaInfo.video.productId,
                PricingPlanId: cc.mediaInfo.video.pricingPlanId,
                ViewContentType: viewContentTypes.video,
                DeliveryCapability: getDCID()
            };

            if (cc.mediaInfo.video.preview === true) {
                viewContentRequest.ViewContentType = viewContentTypes.preview;
                if (cc.mediaInfo.video.previewId) {
                    viewContentRequest.PreviewId = cc.mediaInfo.video.previewId;
                }
            }

            var promise;
            if(cc.mediaInfo.video.preview === true){
                promise = svc.subscriber.content.viewContent(viewContentRequest);
            }else{
                promise = svc.subscriber.content.viewContentChromecast(viewContentRequest);
                promise.done(function(response, status, xhr){
                    var clonedSessionId = xhr ? xhr.getResponseHeader('cd-clonedsessionid') : null;
                    if (clonedSessionId) {
                        svc.settings.sessionId = clonedSessionId;
                    }
                });
            }

            promise.done(function (viewContentResponse) {
                if(window.currentVideo){
                    window.currentVideo.setCurrentTime(cc.mediaInfo.video.productId, viewContentResponse.ProgressSeconds);
                }

                var liveStreaming = viewContentResponse.MediaSubtype === 4;

                evt.data.customData = {
                    mediaId: viewContentResponse.MediaId
                };

                var protocolFunc = null;

                evt.data.media.contentId = viewContentResponse.ContentUrl;
                if (viewContentResponse.ContentUrl.lastIndexOf('.m3u8') >= 0) {
                    protocolFunc = cast.player.api.CreateHlsStreamingProtocol;
                    //ext = 'HLS';
                } else if (viewContentResponse.ContentUrl.lastIndexOf('.mpd') >= 0) {
                    protocolFunc = cast.player.api.CreateDashStreamingProtocol;
                    //ext = 'MPEG-DASH';
                } else if (viewContentResponse.ContentUrl.lastIndexOf('.ism/') >= 0 || viewContentResponse.ContentUrl.lastIndexOf('.isml/') >= 0) {
                    protocolFunc = cast.player.api.CreateSmoothStreamingProtocol;
                    //ext = 'Smooth Streaming';
                }

                if (protocolFunc) {
                    mediaHost = new cast.player.api.Host({
                        'mediaElement': cc.video,
                        'url': viewContentResponse.ContentUrl
                    });

                    if (evt.data.media.customData.settings.licenseUrl) {
                        mediaHost.licenseUrl = evt.data.media.customData.settings.licenseUrl;
                        mediaHost.licenseCustomData = viewContentResponse.LicenseRequestToken;
                    }

                    mediaHost.onError = function (errorCode) {
                        console.log('mediaHost.onError', errorCode);
                        if (errorCode === 2) {
                            cc.controller.setState('error', cc.resources.current.errorSources.license, 100, {
                                originalErrorCode: errorCode
                            });
                        } else if (errorCode === 3) {
                            //this error is thrown when mediaHost cant reach the media server,
                            //the buffer underflow event should have already been raised prior to this happening
                            cc.controller.setState('error', cc.resources.current.errorSources.video, 200, {
                                originalErrorCode: errorCode
                            });
                        } else {
                            cc.controller.setState('error', cc.resources.current.errorSources.video, 100, {
                                originalErrorCode: errorCode
                            });
                        }
                        cc.castEvents.unloadVideo(true);
                    };

                    mediaPlayer = new cast.player.api.Player(mediaHost);
                    cc.protocol = protocolFunc(mediaHost);

                    if (liveStreaming) {
                        mediaPlayer.load(cc.protocol, Infinity);
                        evt.data.media.streamType = cast.receiver.media.StreamType.LIVE;
                    }
                    else {
                        var startTime = 0;
                        if (evt.data.currentTime !== undefined && evt.data.currentTime !== null && evt.data.currentTime >= 0) {
                            startTime = parseInt(evt.data.currentTime, 10);
                        } else if (viewContentResponse.ProgressSeconds) {
                            startTime = viewContentResponse.ProgressSeconds;
                        }
                        mediaPlayer.load(cc.protocol, startTime);
                        evt.data.media.streamType = cast.receiver.media.StreamType.BUFFERED;
                    }
                } else { //No protocol, probably a standard .mp4 file
                    console.log('Using standard Load');
                    origMediaManagerOnLoad.call(mediaManager,
                        new cast.receiver.MediaManager.Event(cast.receiver.MediaManager.EventType.LOAD, evt.data, evt.senderId));
                }
            })
            .fail(function (fault) {
                  cc.controller.setState('error', cc.resources.current.errorSources.api, fault.Code, fault);
                  mediaManager.sendLoadError();
            });
        };

        messageBus.onMessage = function (m) {
            console.log('messageBus.onMessage', m);
            try {
                var message = JSON.parse(m.data);
                if (message && message.command) {
                    try {
                        cc.castEvents[message.command](message.data);
                    } catch (e) {
                        console.log('cast events error', message, e);
                    }
                }
            } catch (e) {
                console.log('error parsing message', e);
            }
        };

        cc.castEvents.unloadVideo = function (isError, preventUpdateContentProgress) {
            if (isError) {
                mediaManager.setIdleReason(cast.receiver.media.IdleReason.ERROR);
            }
            if (mediaPlayer) {
                console.log('unload Video called with media player: ', mediaPlayer);
                var viewingComplete = false;
                if(parseInt(cc.video.currentTime, 10) / parseInt(cc.video.duration, 10) > 0.95){
                    viewingComplete = true;
                }

                var currentTime = cc.video.currentTime;
                if(window.currentVideo && window.currentVideo.getCurrentTime(cc.mediaInfo.video.productId)){
                    currentTime = window.currentVideo.getCurrentTime(cc.mediaInfo.video.productId);
                }
                if (preventUpdateContentProgress !== true) {
                    var updateContentProgressRequest ={
                        ProductId: cc.mediaInfo.video.productId,
                        PricingPlanId: cc.mediaInfo.video.pricingPlanId,
                        ProgressSeconds: parseInt(currentTime, 10),
                        ViewingComplete: viewingComplete,
                        StreamingComplete: true
                    };
                    //if(!parseInt(cc.video.currentTime)){
                    //    delete updateContentProgressRequest.ProgressSeconds;
                    //}
                    svc.subscriber.content.updateContentProgress(updateContentProgressRequest).done(function(result){
                        console.log('UpdateContentProgress Success: ' + JSON.stringify(result));
                    }).fail(function(error){
                        console.log('UpdateContentProgress Failed: ' + JSON.stringify(error));
                    }); //kill the stream on the server
                }
                mediaPlayer.unload();
                mediaPlayer = null;
                mediaHost = null;
            }
            cc.protocol = null;
            cc.mediaInfo = null;
        };

        cc.castEvents.resetMediaElement = function (idleReason, customData) {
            mediaManager.resetMediaElement(idleReason, true, null, customData);
        };

        cc.castEvents.sendErrorMessage = function (data) {
            var message = {
                state: 'error',
                data: data
            };

            try {
                messageBus.broadcast(JSON.stringify(message));
            } catch (e) {
                console.error('failed to send message', e, ' data:', data);
            }
        };

        cc.castEvents.isUnderflow = function () {
            return mediaPlayer && mediaPlayer.getState().underflow;
        };

        cc.castEvents.broadCastStatus = function () {
            mediaManager.broadcastStatus(/* includeMedia */ false);
        };

        /**
         * Changes player state reported to sender, if necessary.
         * See https://github.com/googlecast/Cast-Player-Sample/blob/master/player.js : Line 1087
         * @param {!cast.receiver.media.MediaStatus} mediaStatus Media status that is
         *     supposed to go to sender.
         * @return {cast.receiver.media.MediaStatus} MediaStatus that will be sent to
         *     sender.
         *
         * @private
         */
        mediaManager.customizedStatusCallback = function (mediaStatus) {
            // TODO: remove this workaround once MediaManager detects buffering
            // immediately.
            if (mediaStatus.playerState === cast.receiver.media.PlayerState.PAUSED && cc.castEvents.isUnderflow()) {
                mediaStatus.playerState = cast.receiver.media.PlayerState.BUFFERING;
            }

            return mediaStatus;
        };

        function createSideloadedTrack(i, sideloadedTrack, trackLength) {
            var track = new cast.receiver.media.Track(trackLength + i, cast.receiver.media.TrackType.TEXT);
            track.subtype = cast.receiver.media.TextTrackType.SUBTITLES;
            track.language = sideloadedTrack.language;
            track.trackContentId = sideloadedTrack.url;

            var type = 'ttml';
            var extension = sideloadedTrack.url.split('.').pop();
            switch (extension) {
                case 'vtt':
                    type = 'webvtt';
                    break;
                case 'ttml':
                case 'dfxp':
                    type = 'ttml';
                    break;
                default:
                    type = 'ttml';
                    break;
            }
            track.customData = {
                location: 'sideloaded',
                type: type,
                data: sideloadedTrack
            };
            track.trackContentType = 'text/' + type === 'webvtt' ? 'vtt' : type;
            track.name = sideloadedTrack.language || 'Captions';
            return track;
        }

        function getEmbeddedTracksToMediaInfo(protocol) {
            if (!protocol) {
                return;
            }

            var tracks = [];
            var streamCount = protocol.getStreamCount();
            console.info('adding Embedded Tracks To Media Info', streamCount);
            for (var i = 0; i < streamCount; i++) {
                var streamInfo = protocol.getStreamInfo(i);
                var mimeTypeParts = streamInfo.mimeType.split('/');
                var track = null;
                switch (mimeTypeParts[0]) {
                    case 'text':
                        track = new cast.receiver.media.Track(i, cast.receiver.media.TrackType.TEXT);
                        track.subtype = cast.receiver.media.TextTrackType.SUBTITLES;
                        track.language = streamInfo.language;
                        track.trackContentType = streamInfo.mimeType;
                        track.customData = {
                            location: 'embedded',
                            data: streamInfo
                        };
                        track.name = streamInfo.name || streamInfo.language;
                        break;
                    case 'audio':
                        track = new cast.receiver.media.Track(i, cast.receiver.media.TrackType.AUDIO);
                        track.language = streamInfo.language;
                        track.trackContentType = streamInfo.mimeType;
                        track.customData = {
                            location: 'embedded',
                            data: streamInfo
                        };
                        track.name = streamInfo.name || streamInfo.language;
                        break;
                    case 'video':
                        track = new cast.receiver.media.Track(i, cast.receiver.media.TrackType.VIDEO);
                        track.language = streamInfo.language;
                        track.trackContentType = streamInfo.mimeType;
                        track.customData = {
                            location: 'embedded',
                            data: streamInfo
                        };
                        track.name = 'video';
                        break;
                    default:
                        console.log('unknown stream type', streamInfo);
                }
                if (track) {
                    console.info('adding Embeded Track To Media Info', track);
                    tracks.push(track);
                }
            }
            return tracks;
        }


        function enableEmbeddedTrack(type, streamIndex, afterOn) {
            if (!cc.protocol) {
                return;
            }

            var streamCount = cc.protocol.getStreamCount();
            var trackNumber = parseInt(streamIndex, 10) || -1;

            //disable current tracks
            for (var current = 0; current < streamCount; current++) {
                if (cc.protocol.isStreamEnabled(current)) {
                    if (current !== trackNumber) {
                        var streamInfo = cc.protocol.getStreamInfo(current);
                        if (streamInfo.mimeType.split('/')[0] === type) {
                            console.log('turning off embedded ', type);
                            cc.protocol.enableStream(current, false);
                        }
                    } else {
                        trackNumber = -1;
                    }
                }
            }

            if (trackNumber >= 0 && trackNumber < streamCount) {
                var trackStream = cc.protocol.getStreamInfo(trackNumber);
                if (trackStream.mimeType.split('/')[0] === type) {
                    console.log('turning on embedded ', type);
                    cc.protocol.enableStream(trackNumber, true);
                    if (afterOn && $.isFunction(afterOn)) {
                        afterOn.call(cc.castEvents);
                    }
                }
            }
        }

        // void enableCaptions(enable, opt_type, opt_url)
        // Enable captions. For side-loaded captions, to enable pass both opt_type and opt_url and to disable pass opt_type.
        // For segmented captions in manifests, first use the protocol to enable or disable the stream corresponding to captions and then call this api.
        function disableTextTracks() {
            enableEmbeddedTrack('text', -1);
            if (textTrackType) {
                mediaPlayer.enableCaptions(false, textTrackType);
            } else {
                mediaPlayer.enableCaptions(false);
            }
            textTrackType = null;
        }

        cc.controller.setState('appLoading');
        receiverManager.start(config);
    };
})(window.cc, window.cast, window.jQuery, window.ascendon.service);

window.currentVideo = {
    times: [],
    getCurrentTime: function(productId){
        if(this.times){
            for(var i = 0; i < this.times.length; i+=1){
                if(this.times[i].productId === productId){
                    return this.times[i].currentTime;
                }
            }
        }
        return null;
    },
    setCurrentTime: function(productId, time){
        if(this.getCurrentTime(productId) !== null){
            for(var i = 0; i < this.times.length; i+=1){
                if(this.times[i].productId === productId){
                    this.times[i].currentTime = time;
                }
            }
        } else {
            this.times.push({productId: productId, currentTime: time});
        }
    }
};
