import jwt from "jsonwebtoken";
import redisClient from "../services/redis.service.js";

export const authUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token =
            req.cookies?.token ||
            (authHeader && authHeader.startsWith("Bearer ")
                ? authHeader.split(" ")[1]
                : null);

        if (!token) {
            return res.status(401).json({ error: "Unauthorized User" });
        }

        const isBlackListed = await redisClient.get(token);
        if (isBlackListed) {
            res.clearCookie("token", {
                httpOnly: true,
                secure: true,
                sameSite: "none",
            });
            return res.status(401).json({ error: "Unauthorized User" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error(error);
        return res.status(401).json({ error: "Unauthorized User" });
    }
};
