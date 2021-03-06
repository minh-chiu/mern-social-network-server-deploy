import createError from 'http-errors'
import pick from '../utils/pick'
import catchAsync from '../utils/catchAsync'
import {
  commentService,
  notificationService,
  postService,
  uploadService,
  userService,
} from '../services'

/**
 * Create a post
 * @POST api/posts/
 * @access private
 */
const createPost = catchAsync(async (req, res) => {
  const item = req.body

  if (req.file) {
    const url = await uploadService.uploadPostImage(req.file.path)

    item.image = url
  }

  item.postedBy = req.user.id

  const post = await postService.createPost(item)

  res.status(201).json(post)
})

/**
 * Get all posts
 * @GET api/posts
 * @access public
 */
const getPosts = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['text', 'search', 'followingOnly'])
  const options = pick(req.query, ['sort', 'select', 'limit', 'page'])

  filter.hidden = false
  options.populate = 'postedBy'

  if (filter.followingOnly !== undefined) {
    const followingOnly = filter.followingOnly === 'true'

    if (followingOnly) {
      let userIds = []

      if (!req.user.following) {
        req.user.following = []
      }

      req.user.following.forEach(user => userIds.push(user))
      userIds.push(req.user._id)

      filter.postedBy = { $in: userIds }
    }

    delete filter.followingOnly
  }

  const result = await postService.queryPosts(filter, options)

  res.send(result)
})

/**
 * Get all posts
 * @GET api/posts/profile
 * @access private
 */
const getProfilePosts = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['postedBy', 'onlyReply'])
  const options = pick(req.query, ['sort', 'select', 'limit', 'page'])

  if (filter.postedBy) filter.hidden = false
  else filter.postedBy = req.user.id

  if (filter.onlyReply === 'true') {
    filter.comments = { $in: [filter.postedBy] }

    delete filter.postedBy
  }

  options.populate = 'postedBy'

  const result = await postService.queryPosts(filter, options)

  res.send(result)
})

/**
 * Get a post by post id
 * @GET api/posts/:postId
 * @access public
 */
const getPost = catchAsync(async (req, res) => {
  const post = await postService.getPostById(req.params.postId)

  if (!post) throw createError.NotFound()

  res.send(post)
})

/**
 * Update a post by postId
 * @PATCH api/posts/:postId
 * @access private
 */
const updatePost = catchAsync(async (req, res) => {
  // Update post is pinned = true => pinned = false
  if (req.body.pinned) {
    await postService.updateOne(
      { postedBy: req.user.id, pinned: true },
      { pinned: false }
    )
  }

  // Pin post
  const post = await postService.updatePostById(req.params.postId, req.body)

  res.send(post)
})

/**
 * Like post
 * @Patch api/posts/:postId/like
 * @access private
 */
const likePost = catchAsync(async (req, res) => {
  const { postId } = req.params
  const user = req.user

  // Check user is liked post
  const isLiked = user.likes && user.likes.includes(postId)
  const options = isLiked ? '$pull' : '$addToSet'

  // Update post
  const updatedPost = await postService.updatePostById(postId, {
    [options]: { likes: user.id },
    $inc: { numberLikes: isLiked ? -1 : 1 },
  })

  // Update current user
  const userUpdated = await userService.updateById(user.id, {
    [options]: { likes: postId },
  })

  // Update user in request
  req.user = userUpdated

  // Create notification
  if (!isLiked && updatedPost.postedBy.toString() !== user.id) {
    await notificationService.createNotificationLikePost(
      user.id,
      updatedPost.postedBy,
      updatedPost.id
    )
  }

  // Success
  res.send(updatedPost)
})

/**
 * Delete post by postId
 * @DELETE api/posts/:postId
 * @access private
 */
const deletePost = catchAsync(async (req, res) => {
  const post = await postService.deletePostById(req.params.postId)

  // Delete all comments in post
  await commentService.deleteMany({ post: post.id })

  res.send(post)
})

export {
  createPost,
  getPosts,
  getProfilePosts,
  getPost,
  updatePost,
  deletePost,
  likePost,
}
