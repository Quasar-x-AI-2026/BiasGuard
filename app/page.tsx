"use client";

import Navbar from "@/components/layout/Navbar"
import UsersList from "@/components/layout/UserList";
const Page = () => {
  return (
    <div className="flex">
      <div className="flex flex-col gap-3 max-w-37.5 border-r-2 height-[100vw] overflow-y-auto">
        <UsersList />
      </div>
      <div className="w-full">
        <Navbar />
      </div>
    </div>
  )
}
export default Page