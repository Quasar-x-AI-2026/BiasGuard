"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { VideoIcon } from "lucide-react";
import { Lato as LatoFont } from "next/font/google";

const lato = LatoFont({
    weight: ["900"],
    subsets: ["latin"],
});

const Navbar = () => {
    const { isSignedIn } = useAuth()
    const router = useRouter()
    return (
        <div className="sticky top-0 p-5 flex justify-between border-b-2 bg-gray-300">
            <div className="flex">
                {/* <VideoIcon /> */}
                <span className={`${lato.className} text-2xl text-black`}>ClearHire</span>
            </div>
            {isSignedIn ? <UserButton /> : (
                <div>
                    <Button variant={"outline"} onClick={()=>router.push('/sign-in')}>Sign In</Button>
                    <Button variant={"outline"} onClick={()=>router.push('/sign-up')}>Sign Up</Button>
                </div>
            )}
        </div>
    )
}
export default Navbar