import { BlogPostList, BlogHero } from '@elkdonis/blog-client';
import { getPublishedPosts, checkBlogOwner } from '@elkdonis/blog-server';
import { Title, Text, Paper, Stack, Box, Divider, Image } from '@mantine/core';
import { blogConfig } from '../config/blog';

const QUOTE = `"While working together in an asocial climate, a unique group unity unfolds from each person's heightened commitment to their own internal sources while sharing that Presence with others and being acted on by the Presence of others"`;
const QUOTE_AUTHOR = "Antero Alli";

const BIO = `Artist, Acupuncturist/Medical Qi Gong practitioner, Jason Ford has been leading conscious creatives groups, Corporate and church team building safaris and leadership skills training labs since 1990.

Jason has been trained in traditional healing and initiations, fourth way practices, visual arts, sculpture arts, performance arts, and paratheatre.

He is currently retired from the Foundation for the Study of Objective Art, where he worked in their Galleries Arcturus and City Art.`;

const ABOUT_ELKDONIS = `Now, Hassein, it is necessary for you to understand that there exist upon the Earth certain beings who call themselves artists, though to the ordinary three-brained observer their endeavors might appear as nothing more than amusing diversions, curiosities, or trivial pastimes. And yet, those who are truly attentive — who observe not the surface of movement but the hidden oscillations of the centers — perceive that these so-called artists are engaged in a work far greater than ordinary art, a work which seeks to awaken sensation beyond the merely visual, to stir the centers of perception in ways subtle and lawful, and to transmit vibrations into the field of human consciousness itself.

The labor of these beings is not confined to one category, for the Law of the Universe does not recognize the boundaries imposed by habit or convenience. They move simultaneously in many directions: their forms of expression may include the shaping of matter, the arrangement of sound, the weaving of image and motion, or the recording of transient experience in video or musical notation. And yet, Hassein, the unity of their purpose is evident in every manifestation: a striving to awaken what is asleep, to reveal what is ordinarily hidden, and to communicate not to the mechanical mind but to the hidden centers of perception.

They have created, collectively, a body of work so vast that it may be called monumental, though its monuments are not of stone or metal but of subtle resonance, of disciplined form, and of carefully measured chaos. Within this oeuvre, one may find traces of classical learning — the careful craftsmanship, the knowledge of proportion, of line, of color — yet these traces are interwoven with intuition, with visionary insight, and with an unerring attention to the invisible threads that bind sensation, emotion, and intellect into coherent lawfulness.

And here, Hassein, you must pause to observe: the value of this work is not merely in its technical expertise, though that is present and cannot be denied; nor is it in its diversity, which spans almost every conceivable medium — moving images, recorded sounds, sculpted matter, and combinations thereof. Rather, the true measure lies in the fertility of imagination, in the discipline that refuses compromise, and in the capacity of the laborers to remain conscious in the face of the ordinary mechanical tendencies that would reduce their effort to vanity, habit, or amusement.

In short, Hassein, these beings are engaged in an enterprise which is simultaneously practical and cosmic, mundane and sublime. Their hands, their eyes, their minds, and their attention are instruments for awakening, and their work — though it may be experienced as beauty, subtlety, or spectacle — is in reality a laboratory of being, a lawfully organized attempt to transmit consciousness through form, sound, image, and gesture. And thus, one may say: the true art lies not only in the visible result, but in the discipline, coherence, and lawfulness of the process itself — a process that echoes through the planetary field, touches the Moon, and resonates in ways beyond the comprehension of those who see only the surface of things.`;

export default async function HomePage() {
  const posts = await getPublishedPosts(blogConfig.orgId, 20).catch(() => []);
  const ownerContext = await checkBlogOwner(blogConfig);
  const isOwner = !!ownerContext;

  return (
    <Stack gap="xl">
      {/* Hero with Blog Hero component */}
      <BlogHero hero={blogConfig.hero} isOwner={isOwner} />

      {/* Quote Section */}
      <Paper 
        p="xl" 
        radius="sm"
        style={{
          background: 'linear-gradient(90deg, rgba(201, 162, 39, 0.06) 0%, transparent 100%)',
          borderLeft: '3px solid #c9a227',
        }}
      >
        <Text 
          size="lg" 
          fs="italic" 
          c="dimmed"
          style={{ lineHeight: 1.8, fontFamily: 'var(--font-cormorant)' }}
        >
          {QUOTE}
        </Text>
        <Text size="sm" c="dimmed" mt="md" ta="right">
          — {QUOTE_AUTHOR}
        </Text>
      </Paper>

      {/* Bio Section with Image */}
      <Paper p="xl" radius="sm" className="medieval-card">
        <div className="bio-section">
          {/* Image placeholder - will show rock balancer photo */}
          <Box
            style={{
              width: '100%',
              maxWidth: 300,
              aspectRatio: '3/4',
              background: 'linear-gradient(135deg, rgba(180, 120, 60, 0.1), rgba(35, 25, 18, 0.8))',
              borderRadius: 'var(--mantine-radius-sm)',
              border: '1px solid rgba(180, 120, 60, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Image
              src="/rock-balancer.jpg"
              alt="Jason Ford - Rock Balancing Artist and Shaman"
              fallbackSrc="https://placehold.co/300x400/1a1208/cc8c29?text=Jason+Ford"
              fit="cover"
              h="100%"
              w="100%"
            />
          </Box>
          <Stack gap="md">
            <Title order={2} c="sacredGold.4" style={{ fontFamily: 'var(--font-cinzel)' }}>
              About Jason Ford
            </Title>
            {BIO.split('\n\n').map((paragraph, i) => (
              <Text key={i} size="md" c="dimmed" style={{ lineHeight: 1.9 }}>
                {paragraph}
              </Text>
            ))}
          </Stack>
        </div>
      </Paper>

      <Divider color="rgba(180, 120, 60, 0.2)" />

      {/* Elkdonis Membership / About the Collective */}
      <Paper p="xl" radius="sm" className="medieval-card">
        <Stack gap="lg">
          <Title order={2} c="sacredGold.4" style={{ fontFamily: 'var(--font-cinzel)' }}>
            The Nature of the Collective's Work
          </Title>
          <Text size="xs" c="dimmed" fs="italic">
            Elkdonis Membership
          </Text>
          {ABOUT_ELKDONIS.split('\n\n').map((paragraph, i) => (
            <Text 
              key={i} 
              size="md" 
              c="dimmed" 
              style={{ lineHeight: 1.9, textAlign: 'justify' }}
            >
              {paragraph}
            </Text>
          ))}
        </Stack>
      </Paper>

      <Divider color="rgba(180, 120, 60, 0.2)" my="xl" />

      {/* Blog Posts */}
      {posts.length > 0 && (
        <Stack gap="md">
          <Title order={2} c="sacredGold.4" style={{ fontFamily: 'var(--font-cinzel)' }}>
            Writings & Reflections
          </Title>
          <BlogPostList posts={posts} />
        </Stack>
      )}
    </Stack>
  );
}
