import { Arg, Ctx, FieldResolver, ID, Int, Mutation, Query, Resolver, Root, UseMiddleware } from 'type-graphql';
import { LessThan } from 'typeorm';
import { Post } from '../entities/Post';
import { User } from '../entities/User';
import { checkAuth } from '../middlewares/checkAuth';
import { Context } from '../types/Context';
import { CreatePostInput } from '../types/CreatePostInput';
import { PaginatedPosts } from '../types/PaginatedPosts';
import { PostMutationResponse } from '../types/PostMutationResponse';
import { UpdatePostInput } from '../types/UpdatePostInput';

@Resolver(_of => Post)
export class PostResolver {
  @FieldResolver(_return => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50);
  }

  @FieldResolver(_return => User)
  async user(@Root() root: Post) {
    return await User.findOneBy({ id: root.userId });
  }

  @Mutation(_return => PostMutationResponse)
  async createPost(@Arg('createPostInput') createPostInput: CreatePostInput, @Ctx() { req }: Context): Promise<PostMutationResponse> {
    const { title, text } = createPostInput;
    try {
      const newPost = Post.create({ title, text, userId: req.session.userId });
      await newPost.save();

      return {
        code: 200,
        success: true,
        message: 'Tạo bài đăng thành công',
        post: newPost,
      };
    } catch (error) {
      console.log(error);
      return {
        code: 500,
        success: false,
        message: `Server Internal Error ${error.message}`,
      };
    }
  }

  @Query(_return => PaginatedPosts, { nullable: true })
  async getPosts(@Arg('limit', _type => Int) limit: number, @Arg('cursor', { nullable: true }) cursor?: string): Promise<PaginatedPosts | null> {
    try {
      const totalPostCount = await Post.count();
      const realLimit = Math.min(10, limit);

      const findOptions: { [key: string]: any } = {
        order: {
          createdAt: 'DESC',
        },
        take: realLimit,
      };

      let lastPost: Post[] = [];
      if (cursor) {
        findOptions.where = { createdAt: LessThan(cursor) };

        lastPost = await Post.find({ order: { createdAt: 'ASC' }, take: 1 });
      }

      const posts = await Post.find(findOptions);

      return {
        totalCount: totalPostCount,
        cursor: posts[posts.length - 1].createdAt,
        hasMore: cursor ? posts[posts.length - 1].createdAt.toString() !== lastPost[0].createdAt.toString() : posts.length !== totalPostCount,
        paginatedPosts: posts,
      };
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  @Query(_return => Post, { nullable: true })
  async getPost(@Arg('id', _type => ID) id: number): Promise<Post | null> {
    try {
      const post = await Post.findOneBy({ id });
      return post;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  @Mutation(_return => PostMutationResponse)
  async updatePost(@Arg('updatePostInput') updatePostInput: UpdatePostInput, @Ctx() { req }: Context): Promise<PostMutationResponse> {
    const { id, title, text } = updatePostInput;
    try {
      const existingPost = await Post.findOneBy({ id });
      if (!existingPost) return { code: 400, success: false, message: 'Không tìm thấy bài đăng này' };
      if (existingPost.userId !== req.session.userId) {
        return { code: 401, success: false, message: 'Bạn không có quyền trên bài đăng này' };
      }

      existingPost.title = title;
      existingPost.text = text;
      existingPost.save();

      return { code: 200, success: true, message: 'Cập nhật thành công', post: existingPost };
    } catch (error) {
      console.log(error);
      return {
        code: 500,
        success: false,
        message: `Server Internal Error ${error.message}`,
      };
    }
  }

  @Mutation(_return => PostMutationResponse)
  @UseMiddleware(checkAuth)
  async deletePost(@Arg('id', _type => ID) id: number, @Ctx() { req }: Context): Promise<PostMutationResponse> {
    try {
      const existingPost = await Post.findOneBy({ id });
      if (!existingPost)
        return {
          code: 400,
          success: false,
          message: 'Post not found',
        };

      if (existingPost.userId !== req.session.userId) {
        return { code: 401, success: false, message: 'Bạn không có quyền trên bài đăng này' };
      }

      // await Upvote.delete({postId: id})

      await Post.delete({ id });

      return { code: 200, success: true, message: 'Post deleted successfully', post: existingPost };
    } catch (error) {
      console.log(error);
      return {
        code: 500,
        success: false,
        message: `Server Internal Error ${error.message}`,
      };
    }
  }
}
