# Project Ulysses 2026

A public web tool for the NASA Space Apps Challenge 2026 challenge [Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/).

**Difficulty:** Advanced
**Subjects:** Astrophysics, Planets & Moons, Software

## Intro

Since 2025, NASA’s SPHEREx mission has mapped the whole sky about every six months in 102 bands of near-infrared light, returning images of more than a billion objects. Comets, asteroids, nearby stars, brown dwarfs, and possible new planets give themselves away by shifting between visits. The archive is too large for any one person to search by eye.

The challenge is a public web tool. Someone enters a sky position (right ascension and declination) and the tool plays that patch as a short sequence, so change over time is easy to see.

Check the tool on these targets:

- Barnard's Star
- Epsilon Indi B, a pair of brown dwarfs orbiting a star
- WISE 0855, a fast-moving brown dwarf at right ascension 08h55m10.831s, declination −7°14′42.53″
- Variable stars RW Aurigae and R Draconis

## Key considerations

The challenge lists these as optional directions:

- **Stay current.** New SPHEREx data arrives quickly, so the tool should be easy to update when a release lands.
- **Use all 102 bands.** Present the infrared coverage in a way that helps people make discoveries. Stacking the frames from each of the six detector arrays can improve signal-to-noise. Generating spectra on the fly is a bonus.
- **Compare times.** Let users add or subtract images taken at different times so moving objects stand out.
- **Choose the field of view.** A wider view can follow faster sources, and it takes longer to transfer.
- **Overlay other surveys.** Data from Gaia or WISE can help confirm that something is moving.
- **Share a view.** Putting coordinates in the URL lets other sites embed the tool.
- **Show metadata.** Flags such as contamination help a user judge whether a frame is trustworthy.
- **Use existing astronomy software.** Tools such as Astropy (for the data) and Aladin from the Strasbourg Astronomical Data Center (for display) already solve parts of this problem.

More data and resources are listed on the [challenge page](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/).
