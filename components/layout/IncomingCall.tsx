"use client"

import { useSocket } from "@/context/SocketContext";
import { usePeer } from "@/context/PeerContext";
import { Button } from "../ui/button";

const IncomingCall = () => {
  const { ongoingCall, handleJoinCall, socket } = useSocket();
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

  return (
    <>
      {ongoingCall.isRinging && <div>
        <h2>Incoming Call</h2>
        <Button onClick={handleAccept}>Accept</Button>
        <Button>Reject</Button>
      </div>}
    </>
  )
}
export default IncomingCall