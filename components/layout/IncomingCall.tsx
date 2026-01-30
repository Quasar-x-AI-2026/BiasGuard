"use client"

import { useSocket } from "@/context/SocketContext";
import { Button } from "../ui/button";
import { usePeer } from "@/context/PeerContext";
import { useCallback } from "react";

const IncomingCall = () => {
    const { ongoingCall, handleJoinCall, handleHangup, socket } = useSocket();
    const { createPeer } = usePeer();

    if (!ongoingCall) {
        // console.log("no ongoing call");
        return null;
    }
    console.log(ongoingCall);
    // console.log("there is an ongoing call");

    const handleAccept = () => {
        handleJoinCall(async (stream) => {
            // Logic: Receiver accepts.
            // 1. Get stream (handled by handleJoinCall wrapper and passed here).
            // 2. Create Peer (Initiator) to target the Caller.
            // 3. Signal will be sent automatically by createPeer.
            const callerId = ongoingCall.participants.caller.socketId;

            if (stream && socket && socket.id) {
                createPeer(callerId, socket.id, stream);
            }

            ongoingCall.isRinging = false;
        })
    }

    const handleReject = () => {
        handleHangup({});
    };


    return (
        <>
            {ongoingCall.isRinging && <div>
                <h2 className="text-center mb-3 text-black text-lg font-semibold">Incoming Call</h2>
                <div className="flex gap-4">
                    <Button className="cursor-pointer" onClick={handleAccept}>Accept</Button>
                    <Button className="cursor-pointer" onClick={handleReject}>Reject</Button>
                </div>
            </div>}
        </>
    )
}
export default IncomingCall