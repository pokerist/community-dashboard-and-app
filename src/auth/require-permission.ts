export function requirePermission(permission: string) {
    return (req, res, next) => {
      if (!req.user?.permissions?.has(permission)) {
        return res.status(403).json({
          message: "Forbidden",
        })
      }
      next()
    }
  }
  