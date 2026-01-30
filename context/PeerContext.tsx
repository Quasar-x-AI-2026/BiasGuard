"use client";

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from "react";
import SimplePeer from "simple-peer";
import { useSocket } from "./SocketContext";

interface PeerContextProps {
    peer: SimplePeer.Instance | null;
    createPeer: (userToSignal: string, callerId: string, stream: MediaStream) => SimplePeer.Instance;
    addPeer: (incomingSignal: SimplePeer.SignalData, callerId: string, stream: MediaStream) => SimplePeer.Instance;
    connectionSignal: any; // Store pending signal if needed
}

const PeerContext = createContext<PeerContextProps | null>(null);

export const PeerContextProvider = ({ children }: { children: React.ReactNode }) => {
    const { socket, ongoingCall, localStream, startRecording, stopRecordingById } = useSocket();
    const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
    // const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const [connectionSignal, setConnectionSignal] = useState<any>(null);

    const peerRef = useRef<SimplePeer.Instance | null>(null);

    useEffect(() => {
        peerRef.current = peer;
    }, [peer]);

    const createPeer = useCallback((userToSignal: string, callerId: string, stream: MediaStream) => {
        const newPeer = new SimplePeer({
            initiator: true,
            trickle: false,
        });

        stream.getTracks().forEach(track => {
            newPeer.addTrack(track, stream);
        });

        newPeer.on("signal", (signal) => {
            socket?.emit("conn-signal", { userToSignal, callerId, signal });
        });



        newPeer.on("error", (err: any) => {
            if (err?.code === 'ERR_DATA_CHANNEL' || err?.message?.includes('User-Initiated Abort') || err?.name === 'OperationError') {
                return;
            }
            console.error("Peer connection error:", err);
        });

        setPeer(newPeer);
        return newPeer;
    }, [socket]);

    const addPeer = useCallback((incomingSignal: SimplePeer.SignalData, callerId: string, stream: MediaStream) => {
        const newPeer = new SimplePeer({
            initiator: false,
            trickle: false,
        });

        stream.getTracks().forEach(track => {
            newPeer.addTrack(track, stream);
        });

        newPeer.on("signal", (signal) => {
            socket?.emit("conn-signal", { userToSignal: callerId, callerId: socket?.id, signal });
        });



        newPeer.on("error", (err: any) => {
            if (err?.code === 'ERR_DATA_CHANNEL' || err?.message?.includes('User-Initiated Abort') || err?.name === 'OperationError') {
                return;
            }
            console.error("Peer connection error:", err);
        });

        newPeer.signal(incomingSignal);
        setPeer(newPeer);
        return newPeer;
    }, [socket]);

    useEffect(() => {
        if (!socket) return;

        const handleConnSignal = (data: { signal: SimplePeer.SignalData, callerId: string }) => {
            setConnectionSignal(data);

            if (peerRef.current) {
                peerRef.current.signal(data.signal);
            } else if (ongoingCall && ongoingCall.participants.caller.socketId === socket.id && localStream) {
                console.log("Auto-answering incoming peer connection from receiver");
                addPeer(data.signal, data.callerId, localStream);
            }
        };

        socket.on("conn-signal", handleConnSignal);

        return () => {
            socket.off("conn-signal", handleConnSignal);
        };
    }, [socket, ongoingCall, localStream]);



    return (
        <PeerContext.Provider value={{
            peer,
            createPeer,
            addPeer,
            connectionSignal
        }}>
            {children}
        </PeerContext.Provider>
    );
};

export const usePeer = () => {
    const context = useContext(PeerContext);
    if (!context) {
        throw new Error("usePeer must be used within a PeerContextProvider");
    }
    return context;
};
