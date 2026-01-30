"use client";

import IncomingCall from "@/components/layout/IncomingCall";
import Navbar from "@/components/layout/Navbar"
import UsersList from "@/components/layout/UserList"
import VideoCall from "@/components/layout/VideoCall";
import { useSocket } from "@/context/SocketContext";


const Page = () => {
  const {openCallPopup, setOpenCallPopup} = useSocket();
  return (
    <div className="flex">
      <div className="max-w-37.5 border-r-2 h-screen fixed">
        <UsersList/>
      </div>
      <div className="w-[calc(100%-150px)] justify-center ml-37.5">
        <Navbar />
        {openCallPopup && 
             <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
              <IncomingCall/>
             </div>
        }
        <div className="text-black">
          <VideoCall/>
        </div>
      </div>
    </div>
  )
}
export default Page