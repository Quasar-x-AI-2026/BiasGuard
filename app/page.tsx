"use client";

import IncomingCall from "@/components/layout/IncomingCall";
import Navbar from "@/components/layout/Navbar"
import UsersList from "@/components/layout/UserList"
import VideoCall from "@/components/layout/VideoCall";


const Page = () => {
  return (
    <div>
      <Navbar />
      <UsersList/>
      <IncomingCall/>
      <VideoCall/>
    </div>
  )
}
export default Page