import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
    Dimensions,
    StyleSheet,
    TouchableOpacity,
    View,
    TouchableWithoutFeedback,
    ActivityIndicator,
    Animated,
    Text,
} from 'react-native';
import SafeAreaView from 'react-native-safe-area-view';
import { SafeAreaConsumer } from 'react-native-safe-area-context';
import IconAntDesign from 'react-native-vector-icons/AntDesign';
import Orientation from 'react-native-orientation';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';


export default class VideoPlayer extends Component {
    static get propTypes() {
        return {
            source: Video.propTypes.source.required,
            width: PropTypes.number,
            height: PropTypes.number,
            style: PropTypes.object,
            loop: PropTypes.bool,
            onBack: PropTypes.func,
            isFullScreen: PropTypes.bool,
            resizeMode: Video.propTypes.resizeMode,
        };
    }

    static defaultProps = {
        style: {},
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
        loop: false,
        isFullScreen: false,
        resizeMode: 'contain',
    };

    player = null;

    constructor(props) {
        super(props);

        this.state = {
            resizeMode: this.props.resizeMode,
            volume: 1,
            isFullScreen: this.props.isFullScreen || this.props.resizeMode === 'cover' || false,
            isPlaying: true,
            isControlsVisible: true,
            muted: false,
            rate: 1,
            loading: true,
            error: false,
            progress: 0,

            seeking: false,
            seekerProgress: 0,

            showTimeRemaining: true,
            currentTime: 0,
            duration: 0,

            orientation: 'PORTRAIT',
        };

        this.player = {
            controlTimeoutDelay: 5000,
            controlTimeout: null,
            doubleTabTimeout: null,
            ref: Video,
            lastTap: null,
            seekBarWidth: 0,
        };

        this.animations = {
            bottomControl: {
                marginBottom: new Animated.Value(0),
                opacity: new Animated.Value(1),
            },
            topControl: {
                marginTop: new Animated.Value(0),
                opacity: new Animated.Value(1),
            },
            video: {
                opacity: new Animated.Value(1),
            },
        };
    }

    componentWillMount() {
        const orientation = Orientation.getInitialOrientation();
        if (orientation !== this.state.orientation) {
            this.setState({
                orientation,
            });
        }

        Orientation.addOrientationListener(this.orientationDidChange.bind(this));
    }

    componentWillUnmount() {
        Orientation.removeOrientationListener(this.orientationDidChange.bind(this));
    }

    orientationDidChange(orientation) {
        this.setState({
            orientation,
        });
    }

    onLoadStart() {
        this.setState({ loading: true }, this.setControlTimeout());
    }

    onLoad(data = {}) {
        this.setState({
            loading: false,
            duration: data.duration,
        });

        if (this.state.isControlsVisible) {
            this.resetControlTimeout();
        }
    }

    onError() {
        this.setState({
            loading: false,
            error: true,
        });
    }

    onProgress(data = {}) {
        if (!this.state.seeking) {
            const percent = data.currentTime / this.state.duration;
            this.setState({
                seekerProgress: percent,
                currentTime: data.currentTime,
            });
        } else {
            this.setState({
                currentTime: data.currentTime,
            });
        }
    }

    onEnd() {
        if (!this.props.loop) {
            this.setState(
                {
                    isPlaying: false,
                    seekerProgress: 0,
                    currentTime: this.state.duration,
                },
                () => {
                    if (this.player.ref) {
                        this.player.ref.seek(0);
                    }
                    this.showControls(false);
                },
            );
        } else {
            this.setState(
                {
                    seekerProgress: 1,
                    currentTime: this.state.duration,
                },
                () => this.player.ref && this.player.ref.seek(0),
            );
        }
    }

    onPlayPause() {
        this.resetControlTimeout();

        let { seekerProgress } = this.state;
        if (this.state.seekerProgress === 1 && this.player.ref) {
            this.player.ref.seek(0);
            seekerProgress = 0;
        }

        this.setState({
            seekerProgress,
            isPlaying: !this.state.isPlaying,
        });
    }

    onSeekGrant(e) {
        this.resetControlTimeout();

        this.seekTouchStart = e.nativeEvent.pageX;
        this.seekProgressStart = this.state.seekerProgress;
        this.wasPlayingBeforeSeek = this.state.isPlaying;
        this.setState({
            seeking: true,
            isPlaying: false,
        });
    }

    onSeekRelease() {
        this.resetControlTimeout();

        this.setState({
            seeking: false,
            isPlaying: this.wasPlayingBeforeSeek,
        });
    }

    onSeek(e) {
        const diff = e.nativeEvent.pageX - this.seekTouchStart;
        const ratio = 100 / this.player.seekBarWidth;
        const progress = this.seekProgressStart + ((ratio * diff) / 100);

        this.setState({
            seekerProgress: progress,
        });

        this.player.ref.seek(progress * this.state.duration);
    }

    setControlTimeout() {
        this.player.controlTimeout = setTimeout(() => {
            this.hideControls();
        }, this.player.controlTimeoutDelay);
    }

    clearControlTimeout() {
        clearTimeout(this.player.controlTimeout);
    }

    resetControlTimeout() {
        this.clearControlTimeout();
        this.setControlTimeout();
    }

    calculateTime() {
        if (this.state.showTimeRemaining) {
            const time = this.state.duration - this.state.currentTime;
            return `-${this.formatTime(time)}`;
        }

        return this.formatTime(this.state.currentTime);
    }

    formatTime(val = 0) {
        const time = Math.min(
            Math.max(val, 0),
            this.state.duration,
        );

        const formattedMinutes = Math.floor(time / 60).toFixed(0).padStart(1, 0);
        const formattedSeconds = Math.ceil(time % 60).toFixed(0).padStart(2, 0);

        return `${formattedMinutes}:${formattedSeconds}`;
    }

    hideControls() {
        this.setState(
            { isControlsVisible: false },
            () => {
                this.hideControlAnimation();
                this.clearControlTimeout();
            },
        );
    }

    showControls(autoHide = true) {
        this.setState(
            { isControlsVisible: true },
            () => {
                this.showControlAnimation();
                if (autoHide) {
                    this.setControlTimeout();
                } else {
                    this.clearControlTimeout();
                }
            },
        );
    }

    hideControlAnimation() {
        Animated.parallel([
            Animated.timing(
                this.animations.topControl.opacity,
                { toValue: 0 },
            ),
            Animated.timing(
                this.animations.topControl.marginTop,
                { toValue: -100 },
            ),
            Animated.timing(
                this.animations.bottomControl.opacity,
                { toValue: 0 },
            ),
            Animated.timing(
                this.animations.bottomControl.marginBottom,
                { toValue: -100 },
            ),
        ]).start();
    }

    showControlAnimation() {
        Animated.parallel([
            Animated.timing(
                this.animations.topControl.opacity,
                { toValue: 1 },
            ),
            Animated.timing(
                this.animations.topControl.marginTop,
                { toValue: 0 },
            ),
            Animated.timing(
                this.animations.bottomControl.opacity,
                { toValue: 1 },
            ),
            Animated.timing(
                this.animations.bottomControl.marginBottom,
                { toValue: 0 },
            ),
        ]).start();
    }

    renderTopControls() {
        return (
            <SafeAreaConsumer>
                {insets => (
                    <Animated.View style={[
                        styles.controls.top,
                        {
                            opacity: this.animations.topControl.opacity,
                            marginTop: this.animations.topControl.marginTop,
                            paddingTop: (this.state.orientation === 'PORTRAIT' ? insets.top : 10),
                        },
                    ]}>
                        <View style={[styles.controls.row, styles.controls.topControlGroup]}>
                            <TouchableOpacity
                                style={[styles.controls.column, styles.controls.control]}
                                onPress={this.props.onBack}>
                                <IconAntDesign name="close" size={24} solid color={'#ffff'}/>
                            </TouchableOpacity>

                            {/* <TouchableOpacity */}
                            {/* style={[styles.controls.column, styles.controls.control]} */}
                            {/* onPress={() => { */}
                            {/* this.setState({ volume: !this.state.volume }); */}
                            {/* }}> */}
                            {/* <Icon name={this.state.volume ? 'ios-volume-high' : 'ios-volume-off'} */}
                            {/* size={30} color={'#ffff'}/> */}
                            {/* </TouchableOpacity> */}

                            {this.state.resizeMode !== 'cover' && (
                                <TouchableOpacity
                                    style={[styles.controls.column, styles.controls.control]}
                                    onPress={() => {
                                        this.setState({ isFullScreen: !this.state.isFullScreen });
                                    }}>
                                    <IconAntDesign name={this.state.isFullScreen ? 'shrink' : 'arrowsalt'} size={24} color={'#ffff'}/>
                                </TouchableOpacity>
                            )}
                        </View>
                    </Animated.View>
                )}
            </SafeAreaConsumer>
        );
    }

    renderCenterControls() {
        return (
            <View style={styles.controls.center}>
                <ActivityIndicator style={styles.activityIndicator} animating={this.state.loading}/>
            </View>
        );
    }

    renderBottomControls() {
        return (
            <SafeAreaConsumer>
                {insets => (
                    <Animated.View style={[
                        styles.controls.bottom,
                        {
                            opacity: this.animations.bottomControl.opacity,
                            marginBottom: this.animations.bottomControl.marginBottom,
                            paddingBottom: (this.state.orientation === 'PORTRAIT' ? insets.bottom : 10),
                        },
                    ]}>
                        <View style={[
                            styles.controls.row,
                            styles.controls.control,
                            styles.controls.bottomControlGroup,
                        ]}>
                            <TouchableOpacity
                                style={[styles.controls.column, styles.controls.playPauseButton]}
                                onPress={() => this.onPlayPause()}>
                                <Icon name={this.state.isPlaying ? 'ios-pause' : 'ios-play'} size={24} color={'#ffff'}/>
                            </TouchableOpacity>

                            <View style={[styles.controls.column, styles.flex1]}>
                                { this.renderSeekBar() }
                            </View>

                            <View style={[styles.controls.column]}>
                                <Text style={ styles.controls.text }>
                                    { this.calculateTime() }
                                </Text>
                            </View>
                        </View>
                    </Animated.View>
                )}
            </SafeAreaConsumer>
        );
    }

    renderSeekBar() {
        return (
            <View
                style={styles.controls.seekBar}
                onLayout={({ nativeEvent }) => {
                    this.player.seekBarWidth = nativeEvent.layout.width;
                }}>
                <View style={[
                    { flexGrow: this.state.seekerProgress },
                    styles.controls.seekBarProgress,
                ]}/>
                <View
                    style={[
                        styles.controls.seekBarKnob,
                        this.state.seeking ? { transform: [{ scale: 1 }] } : {},
                    ]}
                    hitSlop={{
                        top: 20, bottom: 20, left: 20, right: 20,
                    }}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetPanResponder={() => true}
                    onResponderGrant={event => this.onSeekGrant(event)}
                    onResponderMove={event => this.onSeek(event)}
                    onResponderRelease={event => this.onSeekRelease(event)}
                    onResponderTerminate={event => this.onSeekRelease(event)}
                />
                <View style={[
                    styles.controls.seekBarBackground,
                    { flexGrow: 1 - this.state.seekerProgress },
                ]} />
            </View>
        );
    }

    render() {
        return (
            <View style={styles.container} forceInset={{ bottom: 'always', top: 'never' }}>
                <TouchableWithoutFeedback
                    onPress={() => {
                        const now = Date.now();
                        if (this.player.lastTap && (now - this.player.lastTap) < 300) {
                            this.setState({ isFullScreen: !this.state.isFullScreen });
                        } else {
                            this.player.lastTap = now;
                        }

                        clearTimeout(this.player.doubleTabTimeout);
                        this.player.doubleTabTimeout = setTimeout(() => {
                            if ((now - this.player.lastTap) === 0) {
                                if (this.state.isControlsVisible) {
                                    this.hideControls();
                                } else {
                                    this.showControls();
                                }
                            }
                        }, 300);
                    }}>
                    <View style={styles.player.container}>
                        <Video
                            {...this.props}
                            style={{
                                ...styles.player.video,
                                ...this.props.style,
                                ...{ width: this.props.width, height: this.props.height },
                            }}
                            ref={(ref) => { this.player.ref = ref; }}
                            fullscreen={false}
                            fullscreenAutorotate={false}
                            controls={false}
                            playInBackground={false}
                            playWhenInactive={false}

                            source={this.props.source}
                            resizeMode={this.state.isFullScreen ? 'cover' : this.state.resizeMode}
                            volume={Number(this.state.volume)}
                            muted={this.state.muted}
                            paused={!this.state.isPlaying}
                            // rate={ this.state.rate }

                            onLoadStart={this.onLoadStart.bind(this)}
                            onLoad={this.onLoad.bind(this)}
                            onProgress={this.onProgress.bind(this)}
                            onError={this.onError.bind(this)}
                            onEnd={this.onEnd.bind(this)}
                        />

                        {this.renderTopControls()}
                        {this.renderCenterControls()}
                        {this.renderBottomControls()}
                    </View>
                </TouchableWithoutFeedback>
            </View>
        );
    }
}

const styles = {
    container: {
        flex: 1,
        width: '100%',
    },
    flex1: {
        flex: 1,
    },
    player: StyleSheet.create({
        activityIndicator: {
            alignItems: 'center',
            bottom: 0,
            justifyContent: 'center',
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: -1,
        },
        container: {
            flex: 1,
        },
        video: {
            bottom: 0,
            left: 0,
            overflow: 'hidden',
            position: 'absolute',
            right: 0,
            top: 0,
        },
    }),
    controls: StyleSheet.create({
        bottom: {
            alignItems: 'stretch',
            flex: 0,
            justifyContent: 'flex-end',
        },
        bottomControlGroup: {
            alignItems: 'center',
            alignSelf: 'stretch',
            justifyContent: 'space-between',
            marginBottom: 5,
            marginLeft: 12,
            marginRight: 12,
            paddingLeft: 0,
        },
        center: {
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
        },
        column: {
            alignItems: 'center',
            flexDirection: 'column',
            justifyContent: 'space-between',
        },
        control: {
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 8,
            paddingBottom: 4,
            paddingLeft: 15,
            paddingRight: 15,
            paddingTop: 4,
        },
        playPauseButton: {
            // backgroundColor: 'red',
            paddingLeft: 12,
            paddingRight: 5,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            // justifyContent: 'space-between',
            height: null,
            width: null,
        },
        seekBar: {
            alignItems: 'center',
            flexDirection: 'row',
            flexGrow: 1,
            height: 30,
            paddingHorizontal: 15,
            width: '100%',
        },
        seekBarBackground: {
            backgroundColor: '#7d7d7d',
            borderRadius: 10,
            height: 6,
        },
        seekBarKnob: {
            backgroundColor: '#fff',
            borderRadius: 10,
            height: 15,
            marginHorizontal: -4,
            transform: [{ scale: 0.8 }],
            width: 15,
            zIndex: 1,
        },
        seekBarProgress: {
            backgroundColor: '#fff',
            borderRadius: 10,
            height: 6,
        },
        text: {
            backgroundColor: 'transparent',
            color: '#FFF',
            fontSize: 14,
            textAlign: 'center',
        },
        top: {
            alignItems: 'stretch',
            flex: 0,
            justifyContent: 'flex-start',
        },
        topControlGroup: {
            alignItems: 'center',
            alignSelf: 'stretch',
            flexDirection: 'row',
            justifyContent: 'space-between',
            margin: 12,
            width: null,
        },
    }),
};
