"use client"

import { useSocket } from "@/context/SocketContext";
import { usePeer } from "@/context/PeerContext";
import { Button } from "../ui/button";
import { useState } from "react";

const IncomingCall = () => {
  const { ongoingCall, handleJoinCall, socket, openCallPopup, setOpenCallPopup, handleHangup } = useSocket();
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

      setOpenCallPopup(false);
    })
  }

  const handleReject = () => {
    // Logic: Receiver rejects.
    // 1. Notify the server about rejection.
    handleHangup({});
    setOpenCallPopup(false);

    // Additional logic to notify the caller can be added here.
  }

  return (
    <>
      {ongoingCall.isRinging && <div className="bg-white shadow-md rounded-md p-8 z-50 absolute">
        <h2 className="text-black font-semibold text-lg mb-3 text-center">Incoming Call</h2>
        <div className="flex gap-4">
          <Button className="cursor-pointer" onClick={handleAccept}>Accept</Button>
          <Button className="cursor-pointer" onClick={handleReject}>Reject</Button>
        </div>
      </div>}
    </>
  )
}
export default IncomingCall