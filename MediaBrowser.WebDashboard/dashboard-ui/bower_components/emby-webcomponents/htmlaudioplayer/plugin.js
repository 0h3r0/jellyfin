define(["events", "browser", "require", "apphost", "appSettings", "htmlMediaHelper"], function(events, browser, require, appHost, appSettings, htmlMediaHelper) {
    "use strict";

    function getDefaultProfile() {
        return new Promise(function(resolve, reject) {
            require(["browserdeviceprofile"], function(profileBuilder) {
                resolve(profileBuilder({}))
            })
        })
    }

    function fade(instance, elem, startingVolume) {
        instance._isFadingOut = !0;
        var newVolume = Math.max(0, startingVolume - .15);
        return console.log("fading volume to " + newVolume), elem.volume = newVolume, newVolume <= 0 ? (instance._isFadingOut = !1, Promise.resolve()) : new Promise(function(resolve, reject) {
            cancelFadeTimeout(), fadeTimeout = setTimeout(function() {
                fade(instance, elem, newVolume).then(resolve, reject)
            }, 100)
        })
    }

    function cancelFadeTimeout() {
        var timeout = fadeTimeout;
        timeout && (clearTimeout(timeout), fadeTimeout = null)
    }

    function supportsFade() {
        return !browser.tv
    }

    function requireHlsPlayer(callback) {
        require(["hlsjs"], function(hls) {
            window.Hls = hls, callback()
        })
    }

    function enableHlsPlayer(url, item, mediaSource, mediaType) {
        return htmlMediaHelper.enableHlsJsPlayer(mediaSource.RunTimeTicks, mediaType) ? -1 !== url.indexOf(".m3u8") ? Promise.resolve() : new Promise(function(resolve, reject) {
            require(["fetchHelper"], function(fetchHelper) {
                fetchHelper.ajax({
                    url: url,
                    type: "HEAD"
                }).then(function(response) {
                    "application/x-mpegurl" === (response.headers.get("Content-Type") || "").toLowerCase() ? resolve() : reject()
                }, reject)
            })
        }) : Promise.reject()
    }

    function HtmlAudioPlayer() {
        function setCurrentSrc(elem, options) {
            elem.removeEventListener("error", onError), unBindEvents(elem), bindEvents(elem);
            var val = options.url;
            console.log("playing url: " + val);
            var seconds = (options.playerStartPositionTicks || 0) / 1e7;
            seconds && (val += "#t=" + seconds), htmlMediaHelper.destroyHlsPlayer(self), self._currentPlayOptions = options;
            var crossOrigin = htmlMediaHelper.getCrossOriginValue(options.mediaSource);
            return crossOrigin && (elem.crossOrigin = crossOrigin), enableHlsPlayer(val, options.item, options.mediaSource, "Audio").then(function() {
                return new Promise(function(resolve, reject) {
                    requireHlsPlayer(function() {
                        var hls = new Hls({
                            manifestLoadingTimeOut: 2e4
                        });
                        hls.loadSource(val), hls.attachMedia(elem), htmlMediaHelper.bindEventsToHlsPlayer(self, hls, elem, onError, resolve, reject), self._hlsPlayer = hls, self._currentSrc = val
                    })
                })
            }, function() {
                return elem.autoplay = !0, htmlMediaHelper.applySrc(elem, val, options).then(function() {
                    return self._currentSrc = val, htmlMediaHelper.playWithPromise(elem, onError)
                })
            })
        }

        function bindEvents(elem) {
            elem.addEventListener("timeupdate", onTimeUpdate), elem.addEventListener("ended", onEnded), elem.addEventListener("volumechange", onVolumeChange), elem.addEventListener("pause", onPause), elem.addEventListener("playing", onPlaying), elem.addEventListener("play", onPlay)
        }

        function unBindEvents(elem) {
            elem.removeEventListener("timeupdate", onTimeUpdate), elem.removeEventListener("ended", onEnded), elem.removeEventListener("volumechange", onVolumeChange), elem.removeEventListener("pause", onPause), elem.removeEventListener("playing", onPlaying), elem.removeEventListener("play", onPlay)
        }

        function createMediaElement() {
            var elem = self._mediaElement;
            return elem || (elem = document.querySelector(".mediaPlayerAudio"), elem || (elem = document.createElement("audio"), elem.classList.add("mediaPlayerAudio"), elem.classList.add("hide"), document.body.appendChild(elem)), elem.volume = htmlMediaHelper.getSavedVolume(), self._mediaElement = elem, elem)
        }

        function onEnded() {
            htmlMediaHelper.onEndedInternal(self, this, onError)
        }

        function onTimeUpdate() {
            var time = this.currentTime;
            self._isFadingOut || (self._currentTime = time, events.trigger(self, "timeupdate"))
        }

        function onVolumeChange() {
            self._isFadingOut || (htmlMediaHelper.saveVolume(this.volume), events.trigger(self, "volumechange"))
        }

        function onPlaying(e) {
            self._started || (self._started = !0, this.removeAttribute("controls"), htmlMediaHelper.seekOnPlaybackStart(self, e.target, self._currentPlayOptions.playerStartPositionTicks)), events.trigger(self, "playing")
        }

        function onPlay(e) {
            events.trigger(self, "unpause")
        }

        function onPause() {
            events.trigger(self, "pause")
        }

        function onError() {
            var errorCode = this.error ? this.error.code || 0 : 0,
                errorMessage = this.error ? this.error.message || "" : "";
            console.log("Media element error: " + errorCode.toString() + " " + errorMessage);
            var type;
            switch (errorCode) {
                case 1:
                    return;
                case 2:
                    type = "network";
                    break;
                case 3:
                    if (self._hlsPlayer) return void htmlMediaHelper.handleHlsJsMediaError(self);
                    type = "mediadecodeerror";
                    break;
                case 4:
                    type = "medianotsupported";
                    break;
                default:
                    return
            }
            htmlMediaHelper.onErrorInternal(self, type)
        }
        var self = this;
        self.name = "Html Audio Player", self.type = "mediaplayer", self.id = "htmlaudioplayer", self.priority = 1, self.play = function(options) {
            return self._started = !1, self._timeUpdated = !1, self._currentTime = null, setCurrentSrc(createMediaElement(), options)
        }, self.stop = function(destroyPlayer) {
            cancelFadeTimeout();
            var elem = self._mediaElement,
                src = self._currentSrc;
            if (elem && src) {
                if (!destroyPlayer || !supportsFade()) return elem.pause(), htmlMediaHelper.onEndedInternal(self, elem, onError), destroyPlayer && self.destroy(), Promise.resolve();
                var originalVolume = elem.volume;
                return fade(self, elem, elem.volume).then(function() {
                    elem.pause(), elem.volume = originalVolume, htmlMediaHelper.onEndedInternal(self, elem, onError), destroyPlayer && self.destroy()
                })
            }
            return Promise.resolve()
        }, self.destroy = function() {
            unBindEvents(self._mediaElement)
        }
    }
    var fadeTimeout;
    return HtmlAudioPlayer.prototype.currentSrc = function() {
        return this._currentSrc
    }, HtmlAudioPlayer.prototype.canPlayMediaType = function(mediaType) {
        return "audio" === (mediaType || "").toLowerCase()
    }, HtmlAudioPlayer.prototype.getDeviceProfile = function(item) {
        return appHost.getDeviceProfile ? appHost.getDeviceProfile(item) : getDefaultProfile()
    }, HtmlAudioPlayer.prototype.currentTime = function(val) {
        var mediaElement = this._mediaElement;
        if (mediaElement) {
            if (null != val) return void(mediaElement.currentTime = val / 1e3);
            var currentTime = this._currentTime;
            return currentTime ? 1e3 * currentTime : 1e3 * (mediaElement.currentTime || 0)
        }
    }, HtmlAudioPlayer.prototype.duration = function(val) {
        var mediaElement = this._mediaElement;
        if (mediaElement) {
            var duration = mediaElement.duration;
            if (htmlMediaHelper.isValidDuration(duration)) return 1e3 * duration
        }
        return null
    }, HtmlAudioPlayer.prototype.seekable = function() {
        var mediaElement = this._mediaElement;
        if (mediaElement) {
            var seekable = mediaElement.seekable;
            if (seekable && seekable.length) {
                var start = seekable.start(0),
                    end = seekable.end(0);
                return htmlMediaHelper.isValidDuration(start) || (start = 0), htmlMediaHelper.isValidDuration(end) || (end = 0), end - start > 0
            }
            return !1
        }
    }, HtmlAudioPlayer.prototype.getBufferedRanges = function() {
        var mediaElement = this._mediaElement;
        return mediaElement ? htmlMediaHelper.getBufferedRanges(this, mediaElement) : []
    }, HtmlAudioPlayer.prototype.pause = function() {
        var mediaElement = this._mediaElement;
        mediaElement && mediaElement.pause()
    }, HtmlAudioPlayer.prototype.resume = function() {
        var mediaElement = this._mediaElement;
        mediaElement && mediaElement.play()
    }, HtmlAudioPlayer.prototype.unpause = function() {
        var mediaElement = this._mediaElement;
        mediaElement && mediaElement.play()
    }, HtmlAudioPlayer.prototype.paused = function() {
        var mediaElement = this._mediaElement;
        return !!mediaElement && mediaElement.paused
    }, HtmlAudioPlayer.prototype.setVolume = function(val) {
        var mediaElement = this._mediaElement;
        mediaElement && (mediaElement.volume = val / 100)
    }, HtmlAudioPlayer.prototype.getVolume = function() {
        var mediaElement = this._mediaElement;
        if (mediaElement) return Math.min(Math.round(100 * mediaElement.volume), 100)
    }, HtmlAudioPlayer.prototype.volumeUp = function() {
        this.setVolume(Math.min(this.getVolume() + 2, 100))
    }, HtmlAudioPlayer.prototype.volumeDown = function() {
        this.setVolume(Math.max(this.getVolume() - 2, 0))
    }, HtmlAudioPlayer.prototype.setMute = function(mute) {
        var mediaElement = this._mediaElement;
        mediaElement && (mediaElement.muted = mute)
    }, HtmlAudioPlayer.prototype.isMuted = function() {
        var mediaElement = this._mediaElement;
        return !!mediaElement && mediaElement.muted
    }, HtmlAudioPlayer.prototype.destroy = function() {}, HtmlAudioPlayer
});