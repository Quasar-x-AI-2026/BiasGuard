"use client"

import { useSocket } from "@/context/SocketContext";
import { Button } from "../ui/button";

const IncomingCall = () => {
    const { ongoingCall, socket } = useSocket();

    if (!ongoingCall) {
        // console.log("no ongoing call");
        return null;
    }
    console.log(ongoingCall);
    // console.log("there is an ongoing call");


    return (
        <>
            {ongoingCall.isRinging && <div>
                <h2 className="text-center mb-3 text-black text-lg font-semibold">Incoming Call</h2>
                <div className="flex gap-4">
                    <Button className="cursor-pointer">Accept</Button>
                    <Button className="cursor-pointer">Reject</Button>
                </div>
            </div>}
        </>
    )
}
export default IncomingCall