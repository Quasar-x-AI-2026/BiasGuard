"use client";

import { useSocket } from "@/context/SocketContext";
import { usePeer } from "@/context/PeerContext";
import { useCallback, useEffect, useState, useRef } from "react";
import VideoContainer from "./VideoContainer";
import { MdMic, MdMicOff, MdVideocam, MdVideocamOff } from "react-icons/md";
import { ScreenShare } from "lucide-react";

const VideoCall = () => {
    const { localStream, handleHangup, ongoingCall, startRecording, stopRecordingById } = useSocket();
    const { remoteVideoTracks, peer, destroyPeer } = usePeer();

    const [isRecording, setIsRecording] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [defaultScreenIndex, setDefaultScreenIndex] = useState(0);

    // for screen sharing using a separate peer
    const [isSharingScreen, setIsSharingScreen] = useState<boolean>(false);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

    // console.log("local stream", localStream);
    console.log("ongoing call in video call", ongoingCall);

    const endCall = useCallback(() => {
        destroyPeer();
        handleHangup({
            callEndedFn: () => {
                destroyPeer()
            }
        });
    }, [destroyPeer, handleHangup])

    useEffect(() => {
        if (!ongoingCall) {
            destroyPeer();
        }
    }, [ongoingCall, destroyPeer]);

    useEffect(() => {
        if (!peer) return;

        const onPeerClose = () => {
            console.log("Peer connection closed remotely");
            endCall();
        };

        const onPeerError = (err: any) => {
            // Ignore benign errors from intentional cleanup
            if (err?.code === 'ERR_DATA_CHANNEL' || err?.message?.includes('User-Initiated Abort') || err?.name === 'OperationError') {
                endCall();
                return;
            }
            console.error("Peer connection error:", err);
            endCall();
        };

        peer.on("close", onPeerClose);
        peer.on("error", onPeerError);

        return () => {
            peer.off("close", onPeerClose);
            peer.off("error", onPeerError);
        };
    }, [peer, endCall]);

    useEffect(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                setIsCameraOn(videoTrack.enabled);
            }
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                setIsMicOn(audioTrack.enabled);
            }
        }
    }, [localStream]);

    const toggleCamera = useCallback(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOn(videoTrack.enabled);
            }
        }
    }, [localStream]);

    const toggleMic = useCallback(() => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicOn(audioTrack.enabled);
            }
        }
    }, [localStream]);


    // Map to store friendly names for remote streams
    const remoteStreamNames = useRef<Map<string, string>>(new Map());
    const nextRemoteCamIndex = useRef(1);

    const getRemoteStreamName = useCallback((streamId: string) => {
        if (!remoteStreamNames.current.has(streamId)) {
            const name = `remote_cam${nextRemoteCamIndex.current}`;
            remoteStreamNames.current.set(streamId, name);
            nextRemoteCamIndex.current += 1;
        }
        return remoteStreamNames.current.get(streamId)!;
    }, []);


    const toggleRecording = useCallback(() => {
        if (!isRecording) {
            setIsRecording(true);
            if (localStream) {
                startRecording(localStream, "local_cam1");
            }
            if (screenStream) {
                startRecording(screenStream, "local_screen");
            }
            remoteVideoTracks.forEach((remoteStream) => {
                const remoteStreamId = remoteStream.getVideoTracks()[0]?.getSettings().deviceId ?? remoteStream.id;
                const friendlyName = getRemoteStreamName(remoteStreamId);
                startRecording(remoteStream, friendlyName);
            });
        } else {
            setIsRecording(false);
            stopRecordingById("local_cam1");
            stopRecordingById("local_screen");
            remoteVideoTracks.forEach((remoteStream) => {
                const remoteStreamId = remoteStream.getVideoTracks()[0]?.getSettings().deviceId ?? remoteStream.id;
                const friendlyName = getRemoteStreamName(remoteStreamId);
                stopRecordingById(friendlyName);
            });
            // Reset remote cam index when recording stops globally? 
            // Maybe better to keep it to ensure uniqueness if they restart recording in same call.
            // For now, we won't reset nextRemoteCamIndex on stop, only on component unmount (ref reset).
        }
    }, [isRecording, localStream, screenStream, remoteVideoTracks, startRecording, stopRecordingById, getRemoteStreamName]);

    // Local Screen Share Recording Effect
    useEffect(() => {
        if (isRecording && screenStream) {
            startRecording(screenStream, "local_screen");
        } else if (isRecording && !screenStream) {
            stopRecordingById("local_screen");
        }
    }, [isRecording, screenStream, startRecording, stopRecordingById]);

    // Remote Tracks Recording Effect
    useEffect(() => {
        if (!isRecording) return;

        // Start recording for new tracks
        remoteVideoTracks.forEach((remoteStream) => {
            const remoteStreamId = remoteStream.getVideoTracks()[0]?.getSettings().deviceId ?? remoteStream.id;
            const friendlyName = getRemoteStreamName(remoteStreamId);
            startRecording(remoteStream, friendlyName);
        });


    }, [remoteVideoTracks, isRecording, startRecording, getRemoteStreamName]);

    const activeRemoteRecordings = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (isRecording) {
            const currentIds = new Set<string>();

            remoteVideoTracks.forEach((remoteStream) => {
                const id = remoteStream.getVideoTracks()[0]?.getSettings().deviceId ?? remoteStream.id;
                const friendlyName = getRemoteStreamName(id);
                currentIds.add(friendlyName);

                if (!activeRemoteRecordings.current.has(friendlyName)) {
                    startRecording(remoteStream, friendlyName);
                    activeRemoteRecordings.current.add(friendlyName);
                }
            });

            // Check for removed streams
            activeRemoteRecordings.current.forEach((friendlyName) => {
                if (!currentIds.has(friendlyName)) {
                    stopRecordingById(friendlyName);
                    activeRemoteRecordings.current.delete(friendlyName);
                }
            });
        } else {
            // If recording stops globally, clear our tracking set (the toggle function handles the actual stopping)
            activeRemoteRecordings.current.clear();
        }
    }, [remoteVideoTracks, isRecording, startRecording, stopRecordingById, getRemoteStreamName]);


    // Auto-switch main screen logic
    useEffect(() => {
        // 1. Handle out of bounds (e.g. screen share stopped and index is now invalid)
        if (remoteVideoTracks.length > 0 && defaultScreenIndex >= remoteVideoTracks.length) {
            setDefaultScreenIndex(0);
            return;
        }

        // 2. Prioritize Video over empty/audio-only streams on the main screen
        // If current selection is valid but has no video, try to find one that does.
        if (remoteVideoTracks.length > 0 && remoteVideoTracks[defaultScreenIndex]) {
            const currentStream = remoteVideoTracks[defaultScreenIndex];
            const currentHasVideo = currentStream.getVideoTracks().length > 0;

            if (!currentHasVideo) {
                const firstVideoIndex = remoteVideoTracks.findIndex(s => s.getVideoTracks().length > 0);
                if (firstVideoIndex !== -1 && firstVideoIndex !== defaultScreenIndex) {
                    setDefaultScreenIndex(firstVideoIndex);
                }
            }
        }
    }, [remoteVideoTracks, defaultScreenIndex]);



    const startScreenShare = async () => {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                screenStream.addTrack(audioTrack);
            }
        }

        setScreenStream(screenStream);
        setIsSharingScreen(true);
        if (peer && screenStream) {
            screenStream.getVideoTracks().forEach((track) => {
                peer.addTrack(track, screenStream);
            });
        }
        if (peer && (peer as any).negotiationNeeded) {
            // Trigger renegotiation if needed
            (peer as any).negotiationNeeded();
        }
    }

    const stopScreenShare = () => {
        if (peer && screenStream) {
            screenStream.getTracks().forEach((track) => {
                if (track.kind === "video") {
                    track.stop();
                    peer.removeTrack(track, screenStream);
                }
            });
        }
        setIsSharingScreen(false);
        setScreenStream(null);
        if (peer && (peer as any).negotiationNeeded) {
            // Trigger renegotiation if needed
            (peer as any).negotiationNeeded();
        }
    }

    const toggleScreenShare = async () => {
        if (isSharingScreen) {
            stopScreenShare();
        } else {
            await startScreenShare();
        }
    }

    console.log("Local: ", localStream);
    console.log("Remote: ", remoteVideoTracks)

    if (!ongoingCall) return null;

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
            {/* Remote Videos */}
            <div className="w-full h-[70vh] relative bg-black/80 rounded-lg overflow-hidden flex mb-4">
                {/* Main Remote Video */}
                <div className="flex-1 flex items-center justify-center bg-black">
                    {remoteVideoTracks[defaultScreenIndex] ? (
                        <VideoContainer
                            streamA={remoteVideoTracks[defaultScreenIndex]}
                            isLocalStreamA={false}
                            isOnCall={true}
                        />
                    ) : (
                        <div className="text-white">Waiting for other user to join...</div>
                    )}
                </div>

                {/* Side Remote Videos */}
                {/* Side Remote Videos */}
                {(remoteVideoTracks.length > 1 || localStream) && (
                    <div className="w-48 flex flex-col gap-2 p-2 bg-black/60 overflow-y-auto custom-scrollbar">
                        {remoteVideoTracks.map((stream, index) => {
                            if (index === defaultScreenIndex) return null;

                            const hasVideo = stream.getVideoTracks().length > 0;

                            if (!hasVideo) {
                                return (
                                    <div key={index} onClick={() => setDefaultScreenIndex(index)} className="cursor-pointer shrink-0">
                                        <VideoContainer
                                            streamA={stream}
                                            isLocalStreamA={false}
                                            isOnCall={true}
                                        />
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={index}
                                    onClick={() => setDefaultScreenIndex(index)}
                                    className="w-full h-28 bg-black rounded-md overflow-hidden border border-white/10 cursor-pointer shrink-0"
                                >
                                    <VideoContainer
                                        streamA={stream}
                                        isLocalStreamA={false}
                                        isOnCall={true}
                                    />
                                </div>
                            );
                        })}

                        {/* Local Stream in Sidebar */}
                        {localStream && (
                            <div className="w-full h-28 bg-black rounded-md overflow-hidden border border-white/10 shrink-0">
                                <VideoContainer
                                    streamA={localStream}
                                    isLocalStreamA={true}
                                    isOnCall={true}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Controls */}
            {ongoingCall && (
                <div className="flex items-center gap-6 p-4 bg-gray-100 rounded-full shadow-md text-black">
                    <button onClick={toggleMic} className="p-3 rounded-full hover:bg-gray-200 transition">
                        {!isMicOn ? <MdMicOff size={28} className="text-rose-500" /> : <MdMic size={28} />}
                    </button>

                    <button
                        onClick={endCall}
                        className="px-6 py-2 bg-rose-500 text-white rounded-full font-semibold hover:bg-rose-600 transition"
                    >
                        End Call
                    </button>

                    <button onClick={toggleCamera} className="p-3 rounded-full hover:bg-gray-200 transition">
                        {!isCameraOn ? <MdVideocamOff size={28} className="text-rose-500" /> : <MdVideocam size={28} />}
                    </button>

                    <button onClick={toggleScreenShare} className="p-3 rounded-full hover:bg-gray-200 transition cursor-pointer">
                        <div className="flex flex-col items-center">
                            <ScreenShare size={20} />
                            {isSharingScreen ? "Stop sharing" : "Share Screen"}
                        </div>
                    </button>

                    {ongoingCall.role === "teacher" && (
                        <button
                            onClick={toggleRecording}
                            className={`px-4 py-2 rounded-full font-semibold transition ${isRecording
                                ? "bg-red-600 text-white hover:bg-red-700"
                                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                }`}
                        >
                            {isRecording ? "Stop Recording" : "Record"}
                        </button>
                    )}
                </div>
            )}
        </div>
    );

};

export default VideoCall;
