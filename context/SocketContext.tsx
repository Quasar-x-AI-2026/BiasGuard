"use client";

import { OngoingCall, SocketUser } from "@/types";
import { useUser } from "@clerk/nextjs";
import { createContext, RefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export interface iSocketContext {
    localStream: MediaStream | null;
    socket: Socket | null;
    isSocketConnected: boolean;
    onlineUsers: SocketUser[] | null;
    handleCall: (user: SocketUser) => void;
    ongoingCall: OngoingCall | null;
    handleHangup: (data: { callEndedFn?: () => void }) => void;
    handleJoinCall: (callBack: (stream: MediaStream) => Promise<void>) => void;
    startRecording: (stream: MediaStream, id: string) => void;
    saveRecording: (blob: Blob, id: string) => void;
    recordersRef: RefObject<Map<string, MediaRecorder>>;
    chunksRef: RefObject<Map<string, Blob[]>>;
    stopRecordingById: (id: string) => void;
    openCallPopup: Boolean;
    setOpenCallPopup: (open: Boolean) => void;
}

const SocketContext = createContext<iSocketContext | null>(null)

export const SocketContextProvider = ({ children }: { children: React.ReactNode }) => {

    const [openCallPopup, setOpenCallPopup] = useState<Boolean>(false);

    // Media Stream State
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

    const recordersRef = useRef<Map<string, MediaRecorder>>(new Map());
    const chunksRef = useRef<Map<string, Blob[]>>(new Map());

    const getUserMedia = useCallback(async (ongoingCall?: OngoingCall | null) => {
        if (localStream) {
            return localStream;
        }
        console.log("getUserMedia ongoing call", ongoingCall);
        try {
            let stream: MediaStream;
            if (ongoingCall?.role === "teacher") {
                console.log("getUserMedia teacher found");
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
            } else if (ongoingCall?.role === "student") {
                console.log("getUserMedia student found");

                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === "videoinput");

                if (videoDevices.length < 1) {
                    console.error("No video devices found");
                    return;
                }

                const stream1 = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: { exact: videoDevices[0].deviceId }
                    },
                    audio: true
                });

                let stream2: MediaStream | undefined;
                if (videoDevices.length >= 2) {
                    stream2 = await navigator.mediaDevices.getUserMedia({
                        video: {
                            deviceId: { exact: videoDevices[1].deviceId }
                        },
                        audio: false,
                    });
                }

                const cam1Track = stream1.getVideoTracks()[0];
                (cam1Track as any)._cameraId = "cam-1";

                stream = stream1;

                if (stream2) {
                    const cam2Track = stream2.getVideoTracks()[0];
                    (cam2Track as any)._cameraId = "cam-2";
                    stream.addTrack(cam2Track);
                }
            } else {
                console.log("getUserMedia no role found");
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
            }
            // const stream = await navigator.mediaDevices.getUserMedia({
            //     video: true,
            //     audio: true
            // });

            setLocalStream(stream);
            return stream;
        } catch (error) {
            console.error("Error accessing media devices:", error);
            return null;
        }
    }, [localStream]);


    // Socket Setup
    const [socket, setSocket] = useState<Socket | null>(null);
    const { user } = useUser();

    useEffect(() => {
        let newSocket = io()

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        }
    }, [user])

    // Socket Connection Status
    const [isSocketConnected, setIsSocketConnected] = useState(false);

    useEffect(() => {
        if (!socket) return;

        const handleConnect = () => {
            setIsSocketConnected(true);
        }

        const handleDisconnect = () => {
            setIsSocketConnected(false);
            handleHangup({});
        }

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
        }
    }, [socket])

    // Online Users
    const [onlineUsers, setOnlineUsers] = useState<SocketUser[] | null>(null);
    const currentSocketUser = onlineUsers?.find(u => u.userId === user?.id);

    useEffect(() => {
        if (!socket || !isSocketConnected || !user) return;

        const handleOnlineUsers = (usersList: SocketUser[]) => {
            setOnlineUsers(usersList);
        };

        socket.on("get-online-users", handleOnlineUsers);
        socket.emit("add-new-user", user);

        return () => {
            socket.off("get-online-users", handleOnlineUsers);
        };
    }, [socket, isSocketConnected, user])

    // Calls
    const [ongoingCall, setOngoingCall] = useState<OngoingCall | null>(null);

    const handleCall = useCallback(async (user: SocketUser) => {
        if (!socket || !currentSocketUser) return;


        const participants = {
            caller: currentSocketUser,
            receiver: user
        }

        const newCall: OngoingCall = {
            participants,
            isRinging: false,
            role: "teacher"
        };

        setOngoingCall(newCall);
        const stream = await getUserMedia(newCall);

        if (!stream) {
            console.error("Failed to get local stream");
            return;
        }
        socket.emit("call", { participants, role: newCall.role });
    }, [socket, currentSocketUser, getUserMedia]);

    const handleHangup = useCallback((data: { callEndedFn?: () => void }) => {
        if (socket && ongoingCall) {
            socket.emit("hangup", {
                ongoingCallId: ongoingCall.participants.caller.userId, // Using userId as ID for simplicity if no specific ID
                participantId: ongoingCall.participants.receiver.socketId
            });
        }

        if (data.callEndedFn) {
            data.callEndedFn();
        }

        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }

        setOngoingCall(null);
    }, [socket, ongoingCall, localStream]);

    const handleJoinCall = useCallback(async (callBack: (stream: MediaStream) => Promise<void>) => {
        const stream = await getUserMedia();

        if (!stream) {
            console.error("Failed to get local stream");
            return;
        }

        setLocalStream(stream);

        await callBack(stream);
    }, [getUserMedia])

    // Incoming Call Listener
    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = (callData: OngoingCall) => {
            setOngoingCall(callData);
            const stream = getUserMedia(callData);

            if (!stream) {
                console.error("Failed to get local stream");
                return;
            }

            setOpenCallPopup(true);
        };

        const handleHangupIncoming = () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                setLocalStream(null);
            }
            setOngoingCall(null);
        }

        socket.on("call", handleIncomingCall);
        socket.on("hangup", handleHangupIncoming);

        return () => {
            socket.off("call", handleIncomingCall);
            socket.off("hangup", handleHangupIncoming);
        }
    }, [socket])

    const startRecording = (stream: MediaStream, id: string) => {
        if (recordersRef.current.has(id))
            return;

        console.log(`Starting recording for ${id} with tracks:`, stream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`));

        chunksRef.current.set(id, []);

        const supportedTypes = [
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9,opus',
            "video/mp4"
        ];

        const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type)) || "video/mp4";
        console.log(`Using mimeType for recording: ${mimeType}`);

        const options = { mimeType };

        try {
            const recorder = new MediaRecorder(stream, options);

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.get(id)?.push(event.data);
                }
            }

            recorder.onstop = () => {
                const chunks = chunksRef.current.get(id) || [];
                const blob = new Blob(chunks, { type: mimeType });
                saveRecording(blob, id);
            };

            recorder.start();
            recordersRef.current.set(id, recorder);
        } catch (error) {
            console.error("Failed to start recording:", error);
        }
    }

    const saveRecording = (blob: Blob, id: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const extension = blob.type.split(";")[0].includes("mp4") ? "mp4" : "webm";
        a.download = `recording_${id}_${Date.now()}.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
        recordersRef.current.delete(id);
        chunksRef.current.delete(id);
    };

    const stopRecordingById = (id: string) => {
        const recorder = recordersRef.current.get(id);
        if (!recorder) return;

        recorder.stop();
    };


    return (
        <SocketContext.Provider value={{
            localStream,
            socket,
            isSocketConnected,
            onlineUsers,
            handleCall,
            ongoingCall,
            handleHangup,
            handleJoinCall,
            startRecording,
            saveRecording,
            recordersRef,
            chunksRef,
            stopRecordingById,
            openCallPopup,
            setOpenCallPopup,
        }}>
            {children}
        </SocketContext.Provider>
    )
}

export const useSocket = () => {
    const context = useContext(SocketContext);

    if (!context) {
        throw new Error("useSocket must be used within a SocketContextProvider")
    }

    return context;
}