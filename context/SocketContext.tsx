"use client";

import { OngoingCall, SocketUser } from "@/types";
import { useUser } from "@clerk/nextjs";
import { createContext, RefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export interface iSocketContext {
    socket: Socket | null;
    isSocketConnected: boolean;
    onlineUsers: SocketUser[] | null;
    handleCall: (user: SocketUser) => void;
    ongoingCall: OngoingCall | null;
}

const SocketContext = createContext<iSocketContext | null>(null)

export const SocketContextProvider = ({ children }: { children: React.ReactNode }) => {

    // Media Stream State
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

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


    return (
        <SocketContext.Provider value={{
            socket,
            isSocketConnected,
            onlineUsers,
            handleCall,
            ongoingCall,
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