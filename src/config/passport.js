import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'
import { config } from './config'
import { User } from '../models'

const jwtOptions = {
  secretOrKey: config.jwt.accessSecret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
}

const jwtVerify = async (payload, done) => {
  try {
    const user = await User.findById(payload.sub)
    if (!user) return done(null, false)
    return done(null, user)
  } catch (error) {
    return done(error, false)
  }
}

export const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify)
