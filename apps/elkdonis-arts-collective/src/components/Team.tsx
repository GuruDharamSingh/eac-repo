"use client";

import { Box, Container, Title, Text, Stack, Grid, Paper, Collapse } from "@mantine/core";
import { User, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TeamMember {
  name: string;
  title: string;
  role: string;
  bio: string;
}

const teamMembers: TeamMember[] = [
  {
    name: "Jason",
    title: "Founder",
    role: "Director of Operations",
    bio: "Jason founded Elkdonis Arts Collective in Newmarket, Ontario in 1990. His vision of combining fourth-way teachings with objective art practice has guided the collective through 30+ years of evolution and transformation. He leads operations and ensures the Work itself remains at the center of all activities.",
  },
  {
    name: "Steph",
    title: "Director of I.T. and Security",
    role: "Technical Infrastructure",
    bio: "Steph oversees all technical infrastructure and security protocols for Elkdonis Arts Collective. Her expertise ensures our digital spaces remain sacred and protected, enabling authentic connection and growth for all members.",
  },
  {
    name: "Dana",
    title: "Co-Founder",
    role: "Artist/Writer in Residence",
    bio: "Dana has been instrumental in shaping the artistic vision of Elkdonis since its founding. As Artist/Writer in Residence, she brings deep inquiry and practice to the collective's exploration of objective art and paratheatre.",
  },
  {
    name: "Guru Dharam",
    title: "Projects Manager",
    role: "Director of Web Development",
    bio: "Guru Dharam manages projects and leads web development initiatives for the collective. His work bridges the technical and spiritual aspects of our digital presence, creating platforms that support authentic fourth-way community.",
  },
  {
    name: "Aeon",
    title: "Executive Producer",
    role: "Music and Video Director, Artist/Writer in Residence",
    bio: "Aeon brings creative vision to our music and video productions. As Executive Producer and Artist/Writer in Residence, they guide the collective's media output with an eye toward objective communication and transcendent expression.",
  },
  {
    name: "Sarah",
    title: "Director of Public Relations",
    role: "Community Outreach",
    bio: "Sarah manages public relations and community outreach for Elkdonis Arts Collective. She serves as a bridge between the inner work of the collective and the wider community of seekers and artists.",
  },
];

function TeamCard({ member, index, isVisible }: { member: TeamMember; index: number; isVisible: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Paper
      className={`team-card ${isVisible ? `animate-scale-in delay-${(index + 2) * 100}` : "opacity-0"}`}
      p={0}
      style={{
        background: "rgba(17, 17, 24, 0.9)",
        border: "1px solid rgba(124, 58, 237, 0.2)",
        overflow: "hidden",
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <Stack gap={0}>
        {/* Avatar placeholder */}
        <Box
          style={{
            height: "200px",
            background: "linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(91, 33, 182, 0.25) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              background: "rgba(201, 169, 98, 0.1)",
              border: "2px solid rgba(201, 169, 98, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <User size={48} color="#c9a962" strokeWidth={1} />
          </Box>
          {/* Decorative rings */}
          <Box
            style={{
              position: "absolute",
              width: "150px",
              height: "150px",
              borderRadius: "50%",
              border: "1px solid rgba(201, 169, 98, 0.1)",
            }}
          />
          <Box
            style={{
              position: "absolute",
              width: "200px",
              height: "200px",
              borderRadius: "50%",
              border: "1px solid rgba(124, 58, 237, 0.1)",
            }}
          />
        </Box>

        {/* Info section */}
        <Box p="lg">
          <Stack gap="xs" align="center" style={{ textAlign: "center" }}>
            <Title
              order={4}
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontSize: "1.5rem",
                fontWeight: 500,
                color: "#f3f4f6",
              }}
            >
              {member.name}
            </Title>
            <Text
              size="sm"
              c="violet.4"
              style={{
                fontWeight: 500,
                letterSpacing: "0.05em",
              }}
            >
              {member.title}
            </Text>
            <Text size="xs" c="gray.5">
              {member.role}
            </Text>

            {/* Expand indicator */}
            <Box
              mt="xs"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: "#9ca3af",
                transition: "transform 0.3s",
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <ChevronDown size={18} />
            </Box>
          </Stack>
        </Box>

        {/* Collapsible bio */}
        <Collapse in={expanded}>
          <Box
            p="lg"
            pt={0}
            style={{
              borderTop: "1px solid rgba(124, 58, 237, 0.15)",
            }}
          >
            <Text
              size="sm"
              c="gray.4"
              style={{
                lineHeight: 1.7,
                textAlign: "center",
              }}
            >
              {member.bio}
            </Text>
          </Box>
        </Collapse>
      </Stack>
    </Paper>
  );
}

export function Team() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <Box
      component="section"
      id="team"
      ref={sectionRef}
      style={{
        background: "#0a0a0f",
        position: "relative",
      }}
      py={100}
    >
      {/* Section divider */}
      <Box className="section-divider" style={{ position: "absolute", top: 0, left: 0, right: 0 }} />

      <Container size="xl">
        <Stack gap={60}>
          {/* Section Header */}
          <Stack gap="md" align="center" style={{ textAlign: "center" }}>
            <Text
              size="sm"
              c="violet.4"
              className={isVisible ? "animate-fade-in" : "opacity-0"}
              style={{
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              The Collective
            </Text>
            <Title
              order={2}
              className={isVisible ? "animate-fade-in-up delay-100" : "opacity-0"}
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontSize: "3rem",
                fontWeight: 400,
                color: "#f3f4f6",
              }}
            >
              Our Members
            </Title>
            <Box
              className={isVisible ? "animate-fade-in delay-200" : "opacity-0"}
              style={{
                width: "60px",
                height: "1px",
                background: "#c9a962",
              }}
            />
            <Text
              size="md"
              c="gray.5"
              maw={600}
              className={isVisible ? "animate-fade-in delay-300" : "opacity-0"}
              style={{ lineHeight: 1.7 }}
            >
              We are all students, and teach in the understanding that we are all
              beginners here. Click on a member to learn more about their role.
            </Text>
          </Stack>

          {/* Team Grid */}
          <Grid gutter="lg">
            {teamMembers.map((member, index) => (
              <Grid.Col span={{ base: 12, sm: 6, md: 4 }} key={member.name}>
                <TeamCard member={member} index={index} isVisible={isVisible} />
              </Grid.Col>
            ))}
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
