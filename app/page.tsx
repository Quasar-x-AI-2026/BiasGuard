"use client";

import IncomingCall from "@/components/layout/IncomingCall";
import Navbar from "@/components/layout/Navbar"
import UsersList from "@/components/layout/UserList";
import { useSocket } from "@/context/SocketContext";

const Page = () => {


  const { ongoingCall, socket } = useSocket();
  return (
    <div className="flex">
      <div className="flex flex-col gap-3 max-w-37.5 border-r-2 h-[100vw] overflow-y-auto overflow-x-hidden">
        <UsersList />
      </div>
      <div className="w-full">
        <Navbar />
        {ongoingCall?.isRinging && <div className="fixed inset-0 bg-black/40 flex justify-center items-center">
          <div className="absolute bg-white p-10 rounded-lg shadow-lg">
            <IncomingCall />
          </div>
        </div>}
      </div>
    </div>
  )
}
export default Page