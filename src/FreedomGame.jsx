import React, { useState, useEffect, useRef } from 'react';

const FreedomGame = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('intro');
  const [player, setPlayer] = useState({ x: 450, y: 300, vx: 0, vy: 0 });
  const [beliefs, setBeliefs] = useState([]);
  const [freedom, setFreedom] = useState(100);
  const [hoveredBelief, setHoveredBelief] = useState(null);
  const [draggingPlayer, setDraggingPlayer] = useState(false);
  const [draggingCluster, setDraggingCluster] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [lockedClusters, setLockedClusters] = useState(new Set());
  const [showAddBelief, setShowAddBelief] = useState(false);
  const [customBeliefText, setCustomBeliefText] = useState('');
  const [customBeliefCategory, setCustomBeliefCategory] = useState('self');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  const animationRef = useRef(null);
  const physicsFrameCounter = useRef(0);
  const keysRef = useRef({});
  const beliefsRef = useRef([]);
  const draggingPlayerRef = useRef(false);
  const lockedClustersRef = useRef(new Set());
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastMouseTime = useRef(0);
  const mouseVelocity = useRef({ x: 0, y: 0 });
  const touchStartRef = useRef(null);

  const width = 630;
  const height = 420;
  const scale = Math.min(width / 900, height / 600);
  const sz = {
    playerR: Math.round(22 * scale),
    beliefR: Math.round(18 * scale),
    beliefRHovered: Math.round(20 * scale),
    haloR: Math.round(24 * scale),
    conflictR: Math.round(13 * scale),
    conflictOffset: Math.round(38 * scale),
    labelOffset: Math.round(34 * scale),
    fontPlayer: Math.round(14 * scale),
    fontLabel: Math.round(11 * scale),
    fontHint: Math.round(10 * scale),
    fontConflict: Math.round(13 * scale),
  };

  const categories = {
    self: { color: '#ef4444', label: 'Self' },
    relationships: { color: '#ec4899', label: 'Relationships' },
    world: { color: '#6366f1', label: 'The World' },
    success: { color: '#f59e0b', label: 'Success' },
    control: { color: '#64748b', label: 'Control' }
  };

  const beliefOptions = [
    { text: "I must be perfect", category: 'self' },
    { text: "I'm not good enough", category: 'self' },
    { text: "I need their approval", category: 'self' },
    { text: "I must always be strong", category: 'self' },
    { text: "They should understand me", category: 'relationships' },
    { text: "My partner completes me", category: 'relationships' },
    { text: "They must agree with me", category: 'relationships' },
    { text: "Life should be fair", category: 'world' },
    { text: "People can't change", category: 'world' },
    { text: "I can't trust anyone", category: 'world' },
    { text: "People are unreliable", category: 'world' },
    { text: "People are generally good", category: 'world' },
    { text: "Success = money", category: 'success' },
    { text: "Work defines my worth", category: 'success' },
    { text: "I must be in control", category: 'control' },
    { text: "Emotions are weakness", category: 'control' },
    { text: "My way is the right way", category: 'control' },
    { text: "Uncertainty is natural", category: 'control' }
  ];

  const oppositions = [
    ["I must be perfect", "I'm not good enough"],
    ["I can't trust anyone", "People are generally good"],
    ["People are unreliable", "People are generally good"],
    ["Emotions are weakness", "Emotions are valid"]
  ];

  const categoryInsights = {
    self: "Holding contradictory beliefs about yourself signals an identity in flux — part of you holds one truth while another part holds the opposite. This inner conflict is often the birthplace of real self-discovery.",
    relationships: "Opposing beliefs about relationships often reflect wounds and hopes living side by side. Your past experiences and present desires haven't yet found common ground.",
    world: "Conflicting worldviews suggest you're genuinely wrestling with life's big questions rather than settling for easy answers. That tension is intellectually honest — and rare.",
    success: "Contradictory beliefs about success reveal a values collision — often between what you were taught to believe and what experience has shown you. Neither feels fully right because neither is fully yours yet.",
    control: "Opposing control beliefs reflect the universal struggle between wanting certainty and accepting that life resists it. You're holding both the need for order and the awareness that it's often an illusion."
  };

  const areBeliefsSimilar = (b1, b2) => b1.category === b2.category;

  const negationWords = new Set([
    'not', 'no', 'never', 'neither', 'nor', "n't",
    "isn't", "can't", "won't", "doesn't", "don't",
    "didn't", "wasn't", "weren't", "hasn't", "haven't",
    "hadn't", "shouldn't", "wouldn't", "couldn't"
  ]);

  const hasNegation = (text) =>
    text.toLowerCase().split(/\s+/).some(w => negationWords.has(w));

  const getContentWords = (text) =>
    text.toLowerCase().split(/\s+/).filter(w => !negationWords.has(w) && w.length > 1);

  const areBeliefsOpposed = (b1, b2) => {
    // Check hardcoded pairs first
    if (oppositions.some(([a, b]) =>
      (b1.text === a && b2.text === b) || (b1.text === b && b2.text === a)
    )) return true;

    // Detect negation-based opposites: one has negation, the other doesn't,
    // but their content words overlap significantly
    const neg1 = hasNegation(b1.text);
    const neg2 = hasNegation(b2.text);
    if (neg1 === neg2) return false; // both or neither negated — not a simple opposite

    const words1 = new Set(getContentWords(b1.text));
    const words2 = new Set(getContentWords(b2.text));
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    return union > 0 && intersection / union > 0.4;
  };

  const getSvgCoordinates = (e, svg) => {
    const rect = svg.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      keysRef.current[e.key] = true;

      if (e.key === ' ' && !isTyping) {
        e.preventDefault();
        if (gameState === 'playing') {
          addRandomBelief();
        }
      }
      if (e.key === 'c' && gameState === 'playing' && !isTyping) {
        setShowAddBelief(prev => !prev);
      }
    };

    const handleKeyUp = (e) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, showAddBelief]);

  useEffect(() => { beliefsRef.current = beliefs; }, [beliefs]);
  useEffect(() => { draggingPlayerRef.current = draggingPlayer; }, [draggingPlayer]);
  useEffect(() => { lockedClustersRef.current = lockedClusters; }, [lockedClusters]);

  const startGame = () => {
    setGameState('playing');
    setBeliefs([]);
    setPlayer({ x: 450, y: 300, vx: 0, vy: 0 });
    setFreedom(100);
    setShowAddBelief(false);
    setLockedClusters(new Set());
    setDraggingCluster(null);
  };

  const addRandomBelief = () => {
    const belief = beliefOptions[Math.floor(Math.random() * beliefOptions.length)];
    addBeliefToGame(belief.text, belief.category);
  };

  const addCustomBelief = () => {
    if (customBeliefText.trim()) {
      addBeliefToGame(customBeliefText.trim(), customBeliefCategory);
      setCustomBeliefText('');
      setShowAddBelief(false);
    }
  };

  const addBeliefToGame = (text, category) => {
    setBeliefs(prev => {
      if (prev.length >= 20) return prev;
      if (prev.some(b => b.text.toLowerCase() === text.toLowerCase())) return prev;

      const existingInCategory = prev.filter(b => b.category === category);
      let x, y;

      if (existingInCategory.length > 0) {
        const centerX = existingInCategory.reduce((sum, b) => sum + b.x, 0) / existingInCategory.length;
        const centerY = existingInCategory.reduce((sum, b) => sum + b.y, 0) / existingInCategory.length;
        const angle = Math.random() * Math.PI * 2;
        const distance = 60 + Math.random() * 60;
        x = centerX + Math.cos(angle) * distance;
        y = centerY + Math.sin(angle) * distance;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const distance = 120 + Math.random() * 100;
        x = player.x + Math.cos(angle) * distance;
        y = player.y + Math.sin(angle) * distance;
      }

      x = Math.max(30, Math.min(width - 30, x));
      y = Math.max(30, Math.min(height - 30, y));

      const newBelief = {
        id: Date.now() + Math.random(),
        text,
        category,
        color: categories[category].color,
        x,
        y,
        vx: 0,
        vy: 0
      };

      setFreedom(prev => Math.max(0, prev - (100 / 15)));
      return [...prev, newBelief];
    });
  };

  const removeBelief = (beliefId) => {
    setBeliefs(prev => prev.filter(b => b.id !== beliefId));
    setFreedom(prev => Math.min(100, prev + (100 / 15)));
  };

  const handleSvgMouseDown = (e) => {
    const svg = canvasRef.current;
    if (!svg) return;

    const { x, y } = getSvgCoordinates(e, svg);
    setDragStartPos({ x, y });
    setHasDragged(false);

    if (e.shiftKey) {
      for (let belief of beliefs) {
        const dx = x - belief.x;
        const dy = y - belief.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 30) {
          setLockedClusters(prev => {
            const newSet = new Set(prev);
            newSet.delete(belief.category);
            return newSet;
          });
          e.preventDefault();
          return;
        }
      }
    }

    const playerDx = x - player.x;
    const playerDy = y - player.y;
    const playerDistance = Math.sqrt(playerDx * playerDx + playerDy * playerDy);

    if (playerDistance < 30) {
      setDraggingPlayer(true);
      e.preventDefault();
      return;
    }

    for (let belief of beliefs) {
      const dx = x - belief.x;
      const dy = y - belief.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 30) {
        setDraggingCluster(belief.category);
        setDragOffset({ x: x - belief.x, y: y - belief.y });
        e.preventDefault();
        return;
      }
    }
  };

  const handleSvgMouseMove = (e) => {
    const svg = canvasRef.current;
    if (!svg) return;

    const { x, y } = getSvgCoordinates(e, svg);

    if (draggingCluster) {
      const now = Date.now();
      const dt = Math.max(1, now - lastMouseTime.current);
      mouseVelocity.current = {
        x: (x - lastMousePos.current.x) / dt * 16,
        y: (y - lastMousePos.current.y) / dt * 16
      };
      lastMousePos.current = { x, y };
      lastMouseTime.current = now;
    }

    if ((draggingPlayer || draggingCluster) && !hasDragged) {
      const dx = x - dragStartPos.x;
      const dy = y - dragStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 10) {
        setHasDragged(true);
      }
    }

    if (draggingPlayer) {
      setPlayer(prev => ({
        ...prev,
        x: Math.max(30, Math.min(width - 30, x)),
        y: Math.max(30, Math.min(height - 30, y)),
        vx: 0,
        vy: 0
      }));
      return;
    }

    if (draggingCluster) {
      const targetX = x - dragOffset.x;
      const targetY = y - dragOffset.y;

      setBeliefs(prevBeliefs => {
        const clusterBeliefs = prevBeliefs.filter(b => b.category === draggingCluster);
        if (clusterBeliefs.length === 0) return prevBeliefs;

        const centerX = clusterBeliefs.reduce((sum, b) => sum + b.x, 0) / clusterBeliefs.length;
        const centerY = clusterBeliefs.reduce((sum, b) => sum + b.y, 0) / clusterBeliefs.length;

        const offsetX = targetX - centerX;
        const offsetY = targetY - centerY;

        const otherBeliefs = prevBeliefs.filter(b => b.category !== draggingCluster);
        const wouldOverlap = clusterBeliefs.some(cb => {
          const nx = Math.max(30, Math.min(width - 30, cb.x + offsetX));
          const ny = Math.max(30, Math.min(height - 30, cb.y + offsetY));
          return otherBeliefs.some(ob => {
            const dx = nx - ob.x;
            const dy = ny - ob.y;
            return Math.sqrt(dx * dx + dy * dy) < 50;
          });
        });

        if (wouldOverlap) return prevBeliefs;

        return prevBeliefs.map(belief => {
          if (belief.category === draggingCluster) {
            return {
              ...belief,
              x: Math.max(30, Math.min(width - 30, belief.x + offsetX)),
              y: Math.max(30, Math.min(height - 30, belief.y + offsetY)),
              vx: 0,
              vy: 0
            };
          }
          return belief;
        });
      });
      return;
    }

    if (!draggingPlayer && !draggingCluster) {
      let foundId = null;

      for (let belief of beliefs) {
        const dx = x - belief.x;
        const dy = y - belief.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 30) {
          foundId = belief.id;
          break;
        }
      }

      if (foundId !== hoveredBelief) {
        setHoveredBelief(foundId);
      }
    }
  };

  const handleSvgMouseUp = () => {
    if (draggingCluster) {
      const { x: vx, y: vy } = mouseVelocity.current;
      const clamp = v => Math.max(-10, Math.min(10, v));
      setBeliefs(prev => prev.map(b =>
        b.category === draggingCluster ? { ...b, vx: clamp(vx), vy: clamp(vy) } : b
      ));
    }
    setDraggingPlayer(false);
    setDraggingCluster(null);
    setTimeout(() => setHasDragged(false), 0);
  };

  const handleSvgClick = (e) => {
    if (hasDragged) return;

    const svg = canvasRef.current;
    if (!svg) return;

    const { x, y } = getSvgCoordinates(e, svg);

    if (!e.shiftKey) {
      for (let belief of beliefs) {
        const dx = x - belief.x;
        const dy = y - belief.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 30) {
          removeBelief(belief.id);
          return;
        }
      }
    }
  };

  // Touch handlers
  const handleTouchStart = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    touchStartRef.current = { time: Date.now(), clientX: t.clientX, clientY: t.clientY };
    handleSvgMouseDown(e);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    handleSvgMouseMove(e);
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    handleSvgMouseUp();

    // Treat as tap if finger barely moved and lifted quickly
    if (touchStartRef.current) {
      const t = e.changedTouches[0];
      const dt = Date.now() - touchStartRef.current.time;
      const dx = t.clientX - touchStartRef.current.clientX;
      const dy = t.clientY - touchStartRef.current.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dt < 300 && dist < 10) {
        const svg = canvasRef.current;
        if (svg) {
          const { x, y } = getSvgCoordinates(e, svg);
          for (let belief of beliefs) {
            const bdx = x - belief.x;
            const bdy = y - belief.y;
            if (Math.sqrt(bdx * bdx + bdy * bdy) < 30) {
              removeBelief(belief.id);
              break;
            }
          }
        }
      }
      touchStartRef.current = null;
    }
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = () => {
      if (!draggingPlayerRef.current) {
        setPlayer(prev => {
          let newVx = prev.vx;
          let newVy = prev.vy;

          const baseSpeed = 0.4;
          const speedMultiplier = Math.max(0.1, 1 - (beliefsRef.current.length * 0.05));
          const speed = baseSpeed * speedMultiplier;

          const currentKeys = keysRef.current;
          const isMoving = currentKeys['ArrowLeft'] || currentKeys['a'] || currentKeys['ArrowRight'] || currentKeys['d'] ||
                          currentKeys['ArrowUp'] || currentKeys['w'] || currentKeys['ArrowDown'] || currentKeys['s'];

          if (currentKeys['ArrowLeft'] || currentKeys['a']) newVx -= speed;
          if (currentKeys['ArrowRight'] || currentKeys['d']) newVx += speed;
          if (currentKeys['ArrowUp'] || currentKeys['w']) newVy -= speed;
          if (currentKeys['ArrowDown'] || currentKeys['s']) newVy += speed;

          if (isMoving) {
            beliefsRef.current.forEach((belief) => {
              const dx = belief.x - prev.x;
              const dy = belief.y - prev.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const maxDistance = 80;

              if (distance > maxDistance) {
                const baseForce = 0.08;
                const forceMultiplier = 1 + (beliefsRef.current.length * 0.15);
                const force = (distance - maxDistance) * baseForce * forceMultiplier;

                newVx += (dx / distance) * force;
                newVy += (dy / distance) * force;
              }
            });
          }

          const dampingFactor = isMoving ? Math.max(0.7, 0.92 - (beliefsRef.current.length * 0.015)) : 0.8;
          newVx *= dampingFactor;
          newVy *= dampingFactor;

          let newX = prev.x + newVx;
          let newY = prev.y + newVy;

          newX = Math.max(30, Math.min(width - 30, newX));
          newY = Math.max(30, Math.min(height - 30, newY));

          return { x: newX, y: newY, vx: newVx, vy: newVy };
        });
      }

      physicsFrameCounter.current++;
      const physicSkip = beliefsRef.current.length > 8 ? 3 : 1;

      if (physicsFrameCounter.current % physicSkip === 0) {
        setBeliefs(prevBeliefs => {
          return prevBeliefs.map((belief, i) => {
            if (lockedClustersRef.current.has(belief.category)) {
              return belief;
            }

            let newVx = belief.vx || 0;
            let newVy = belief.vy || 0;

            prevBeliefs.forEach((other, j) => {
              if (i === j) return;

              const dx = other.x - belief.x;
              const dy = other.y - belief.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance < 1 || distance > 300) return;

              if (areBeliefsOpposed(belief, other)) {
                const repelDistance = 200;
                if (distance < repelDistance) {
                  const force = (repelDistance - distance) * 0.03;
                  newVx -= (dx / distance) * force;
                  newVy -= (dy / distance) * force;
                }
              } else if (areBeliefsSimilar(belief, other)) {
                if (distance < 90) {
                  const force = (90 - distance) * 0.06;
                  newVx -= (dx / distance) * force;
                  newVy -= (dy / distance) * force;
                } else if (distance > 130 && distance < 230) {
                  const force = (distance - 130) * 0.015;
                  newVx += (dx / distance) * force;
                  newVy += (dy / distance) * force;
                }
              } else if (distance < 110) {
                const force = (110 - distance) * 0.03;
                newVx -= (dx / distance) * force;
                newVy -= (dy / distance) * force;
              }
            });

            newVx *= 0.95;
            newVy *= 0.95;

            let newX = belief.x + newVx;
            let newY = belief.y + newVy;

            newX = Math.max(30, Math.min(width - 30, newX));
            newY = Math.max(30, Math.min(height - 30, newY));

            return { ...belief, x: newX, y: newY, vx: newVx, vy: newVy };
          });
        });
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const freedomColor = freedom > 60 ? '#10b981' : freedom > 30 ? '#f59e0b' : '#ef4444';

  // Find opposing belief pairs within each cluster
  const clusterConflicts = Object.keys(categories).reduce((acc, cat) => {
    const catBeliefs = beliefs.filter(b => b.category === cat);
    const pairs = [];
    for (let i = 0; i < catBeliefs.length; i++) {
      for (let j = i + 1; j < catBeliefs.length; j++) {
        if (areBeliefsOpposed(catBeliefs[i], catBeliefs[j])) {
          pairs.push([catBeliefs[i], catBeliefs[j]]);
        }
      }
    }
    if (pairs.length > 0) acc[cat] = pairs;
    return acc;
  }, {});

  const generateHolisticInsight = () => {
    if (beliefs.length === 0) return [];

    const insights = [];
    const texts = beliefs.map(b => b.text.toLowerCase());
    const counts = Object.keys(categories).reduce((acc, cat) => {
      acc[cat] = beliefs.filter(b => b.category === cat).length;
      return acc;
    }, {});
    const totalConflicts = Object.values(clusterConflicts).reduce((s, p) => s + p.length, 0);
    const activeCats = Object.values(counts).filter(c => c > 0).length;

    // Self-worth patterns
    const selfBeliefs = beliefs.filter(b => b.category === 'self');
    const negSelfCount = selfBeliefs.filter(b =>
      /\b(not|never|can't|can't|wrong|weak|bad|fail|unworthy)\b/.test(b.text.toLowerCase())
      || b.text.toLowerCase().includes("not good enough")
      || b.text.toLowerCase().includes("need their approval")
    ).length;
    if (negSelfCount >= 2) {
      insights.push("Several of your self-beliefs carry a critical voice — a pattern that often forms early and quietly shapes how much freedom you allow yourself.");
    } else if (counts.self >= 2) {
      insights.push("A notable portion of your beliefs are about yourself — your identity is doing a lot of work in how you interpret the world.");
    }

    // Control patterns
    if (counts.control >= 3) {
      insights.push("A dense cluster of control beliefs reveals that certainty functions as a coping mechanism — when the world feels unpredictable, rules and right-ways feel like solid ground.");
    } else if (texts.some(t => t.includes("must be in control") || t.includes("my way is the right way"))) {
      insights.push("Beliefs about control often signal that uncertainty has felt threatening at some point. The need to have things a certain way is rarely about the thing itself.");
    }

    // Relational patterns
    if (counts.relationships >= 3) {
      insights.push("Your sense of self appears strongly tied to other people — how they treat you, what they think, whether they stay. This makes relationships both deeply important and potentially costly to your freedom.");
    }

    // Success / worth equation
    if (texts.some(t => t.includes("work defines") || t.includes("success = money") || t.includes("worth"))) {
      insights.push("Tying worth to achievement is one of the most common and quietly exhausting belief patterns — it means rest never fully feels safe.");
    }

    // Internal contradictions across the whole system
    if (totalConflicts >= 3) {
      insights.push("Your belief system holds several simultaneous contradictions. This much internal conflict rarely means confusion — it usually means you're in the middle of changing, even if it doesn't feel that way yet.");
    } else if (totalConflicts === 1) {
      insights.push("There's one live contradiction in your belief web. That tension — holding two truths that can't both be right — is often where the most important inner work happens.");
    }

    // Breadth of beliefs
    if (activeCats >= 4 && beliefs.length >= 10) {
      insights.push("Your beliefs span almost every domain — self, others, the world, success, and control. A comprehensive belief system creates a feeling of coherence, but it also means freedom is constrained from every direction at once.");
    }

    // High belief volume
    if (beliefs.length >= 15) {
      insights.push("With this many beliefs active simultaneously, the web becomes self-reinforcing: each belief makes the others feel more true, and together they narrow what feels possible.");
    }

    // Cross-category value-vs-drive constraints
    // Detect prosocial / ethical value beliefs
    const prosocialKeywords = ['kind', 'fair', 'honest', 'good', 'trust', 'care', 'love', 'help', 'understand', 'complet', 'should be fair', 'generally good'];
    const driveKeywords = ['win', 'all costs', 'defines my worth', 'success = money', 'must be in control', 'my way is the right way', 'must be perfect', 'must always be strong', 'must be in control'];

    const prosocialBeliefs = beliefs.filter(b =>
      prosocialKeywords.some(k => b.text.toLowerCase().includes(k))
    );
    const driveBeliefs = beliefs.filter(b =>
      driveKeywords.some(k => b.text.toLowerCase().includes(k))
    );

    if (prosocialBeliefs.length >= 1 && driveBeliefs.length >= 1) {
      const examples = prosocialBeliefs.slice(0, 1).map(p =>
        driveBeliefs.slice(0, 1).map(d =>
          `believing in "${p.text}" while also holding "${d.text}"`
        )
      ).flat();
      insights.push(
        `Some of your beliefs constrain each other not by contradiction, but by limiting your options. ${examples[0] ? `For example, ${examples[0]} — the first doesn't negate the second, but it rules out many of the methods the second might otherwise justify.` : 'A value belief quietly narrows the strategies available to your goal-driven beliefs.'} This is a more hidden form of constraint than outright conflict.`
      );
    }

    // Mostly one category
    const maxCount = Math.max(...Object.values(counts));
    if (maxCount >= 5 && maxCount / beliefs.length > 0.5) {
      const dominant = Object.entries(counts).find(([, c]) => c === maxCount);
      const domLabel = categories[dominant[0]].label.toLowerCase();
      insights.push(`Over half your beliefs concentrate in one area: ${domLabel}. When a single domain dominates, it tends to become the lens through which everything else gets interpreted.`);
    }

    return insights;
  };

  const holisticInsights = generateHolisticInsight();

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      minHeight: '100vh',
      padding: isMobile ? '10px' : '20px',
      boxSizing: 'border-box',
      overflow: 'auto'
    }}>
      <div style={{ maxWidth: '1360px', width: '100%', margin: '0 auto' }}>
        {gameState === 'intro' && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: isMobile ? '24px 16px' : '30px 20px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            textAlign: 'center'
          }}>
            <h1 style={{ fontSize: isMobile ? '1.8em' : '2.5em', margin: '0 0 15px 0', color: '#1f2937' }}>
              The Weight of Certainty
            </h1>
            <p style={{ fontSize: '1.1em', color: '#6b7280', marginBottom: '20px', lineHeight: '1.6' }}>
              An interactive exploration of how our beliefs shape our freedom
            </p>
            <div style={{ maxWidth: '600px', margin: '0 auto 20px', textAlign: 'left' }}>
              <p style={{ color: '#374151', marginBottom: '6px' }}>• Start with complete freedom of movement</p>
              <p style={{ color: '#374151', marginBottom: '6px' }}>• Each belief you adopt constrains you slightly</p>
              <p style={{ color: '#374151', marginBottom: '6px' }}>• Similar beliefs cluster together</p>
              <p style={{ color: '#374151' }}>• Contradictory beliefs create tension</p>
            </div>
            <button
              onClick={startGame}
              style={{
                padding: '14px 36px',
                fontSize: '1.1em',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Begin Experience
            </button>
          </div>
        )}

        {gameState === 'playing' && (
          <>
            {/* Header */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '12px 16px',
              marginBottom: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <h2 style={{ fontSize: isMobile ? '1.1em' : '1.4em', margin: 0, color: '#1f2937', flex: 1, textAlign: 'center' }}>
                The Weight of Certainty
              </h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {isMobile && (
                  <button
                    onClick={addRandomBelief}
                    style={{
                      padding: '10px 14px',
                      fontSize: '0.9em',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    + Random
                  </button>
                )}
                <button
                  onClick={() => setShowAddBelief(!showAddBelief)}
                  style={{
                    padding: '10px 14px',
                    fontSize: '0.9em',
                    background: '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {isMobile ? '+ Custom' : 'Create Belief (C)'}
                </button>
                <button
                  onClick={startGame}
                  style={{
                    padding: '10px 14px',
                    fontSize: '0.9em',
                    background: '#64748b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '12px 20px',
              marginBottom: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              display: 'flex',
              justifyContent: 'space-around',
              gap: '15px'
            }}>
              <div>
                <div style={{ fontSize: '0.8em', color: '#6b7280', marginBottom: '2px' }}>Beliefs Held</div>
                <div style={{ fontSize: '1.5em', fontWeight: '700', color: beliefs.length >= 20 ? '#dc2626' : '#ef4444' }}>
                  {beliefs.length}/20
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8em', color: '#6b7280', marginBottom: '2px' }}>Freedom</div>
                <div style={{ fontSize: '1.5em', fontWeight: '700', color: freedomColor }}>
                  {Math.round(freedom)}%
                </div>
              </div>
            </div>

            {/* Custom belief panel */}
            {showAddBelief && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '10px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1em', color: '#1f2937' }}>
                  Create Custom Belief
                </h3>
                <input
                  type="text"
                  value={customBeliefText}
                  onChange={(e) => setCustomBeliefText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCustomBelief(); }}
                  placeholder="Enter your belief..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '1em',
                    borderRadius: '6px',
                    border: '2px solid #e5e7eb',
                    marginBottom: '10px',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  {Object.keys(categories).map(cat => (
                    <label key={cat} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        value={cat}
                        checked={customBeliefCategory === cat}
                        onChange={(e) => setCustomBeliefCategory(e.target.value)}
                        style={{ marginRight: '5px' }}
                      />
                      <span style={{ color: categories[cat].color, fontWeight: '600', fontSize: '0.9em' }}>
                        {categories[cat].label}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={addCustomBelief}
                  style={{
                    padding: '10px 20px',
                    fontSize: '1em',
                    background: '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Add Belief
                </button>
              </div>
            )}

            {/* Canvas + Sidebar */}
            <div style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
              flexDirection: isMobile ? 'column' : 'row'
            }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              flex: 1,
              minWidth: 0
            }}>
                <svg
                  ref={canvasRef}
                  viewBox={`0 0 ${width} ${height}`}
                  preserveAspectRatio="xMidYMid meet"
                  onMouseDown={handleSvgMouseDown}
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={handleSvgMouseUp}
                  onMouseLeave={handleSvgMouseUp}
                  onClick={handleSvgClick}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{
                    width: '100%',
                    height: 'auto',
                    background: '#f0f9ff',
                    borderRadius: '8px',
                    cursor: hoveredBelief ? 'pointer' : draggingPlayer || draggingCluster ? 'grabbing' : 'default',
                    display: 'block',
                    touchAction: 'none'
                  }}
                >
                  {beliefs.map((belief) => (
                    <line
                      key={`line-${belief.id}`}
                      x1={player.x}
                      y1={player.y}
                      x2={belief.x}
                      y2={belief.y}
                      stroke={belief.color}
                      strokeWidth="2"
                      opacity="0.4"
                    />
                  ))}

                  <circle cx={player.x} cy={player.y} r="22" fill="#3b82f6" stroke="#1e40af" strokeWidth="3" style={{ cursor: 'grab' }} />
                  <text x={player.x} y={player.y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="white" style={{ pointerEvents: 'none' }}>
                    YOU
                  </text>

                  {beliefs.map((belief) => {
                    const isHovered = belief.id === hoveredBelief;
                    const isLocked = lockedClusters.has(belief.category);

                    const ldx = belief.x - player.x;
                    const ldy = belief.y - player.y;
                    const ldist = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
                    const lnx = ldx / ldist;
                    const lny = ldy / ldist;
                    const labelX = belief.x + lnx * 34;
                    const labelY = belief.y + lny * 34 + 4;
                    const labelAnchor = lnx > 0.3 ? 'start' : lnx < -0.3 ? 'end' : 'middle';

                    return (
                      <g key={belief.id}>
                        {isHovered && (
                          <circle cx={belief.x} cy={belief.y} r="24" fill={belief.color} opacity="0.2" />
                        )}
                        <circle
                          cx={belief.x}
                          cy={belief.y}
                          r={isHovered ? 20 : 18}
                          fill={belief.color}
                          stroke={isLocked ? "#10b981" : isHovered ? "#fbbf24" : "#1f2937"}
                          strokeWidth={isLocked ? 4 : isHovered ? 3 : 2.5}
                          strokeDasharray={isLocked ? "4,2" : "none"}
                          opacity="0.9"
                          style={{ cursor: 'grab' }}
                        />
                        <text
                          x={labelX}
                          y={labelY}
                          textAnchor={labelAnchor}
                          fontSize="11"
                          fontWeight="600"
                          fill="#1f2937"
                          style={{ pointerEvents: 'none' }}
                        >
                          {belief.text.substring(0, 25)}{belief.text.length > 25 ? '...' : ''}
                        </text>
                        {isHovered && (
                          <text
                            x={belief.x + lnx * 34}
                            y={belief.y + lny * 34 + 18}
                            textAnchor={labelAnchor}
                            fontSize="10"
                            fontWeight="600"
                            fill="#f59e0b"
                            style={{ pointerEvents: 'none' }}
                          >
                            Drag cluster • Click to remove
                          </text>
                        )}
                      </g>
                    );
                  })}

                {/* Conflict badges on clusters */}
                {Object.keys(clusterConflicts).map(cat => {
                  const catBeliefs = beliefs.filter(b => b.category === cat);
                  const cx = catBeliefs.reduce((s, b) => s + b.x, 0) / catBeliefs.length;
                  const cy = catBeliefs.reduce((s, b) => s + b.y, 0) / catBeliefs.length;
                  return (
                    <g key={`conflict-${cat}`} style={{ pointerEvents: 'none' }}>
                      <circle cx={cx} cy={cy - 38} r="13" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2" opacity="0.95" />
                      <text x={cx} y={cy - 33} textAnchor="middle" fontSize="13">⚡</text>
                    </g>
                  );
                })}
                </svg>
            </div>

              {/* Sidebar: controls + categories */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                width: isMobile ? '100%' : '200px',
                flexShrink: 0
              }}>
                {/* Controls hint */}
                <div style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '12px 16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  fontSize: '0.82em',
                  color: '#6b7280'
                }}>
                  {isMobile ? (
                    <>
                      <div style={{ marginBottom: '5px' }}><strong>Tap belief</strong> to remove</div>
                      <div style={{ marginBottom: '5px' }}><strong>Drag YOU</strong> to move</div>
                      <div><strong>Drag belief</strong> to move cluster</div>
                    </>
                  ) : (
                    <>
                      <div style={{ marginBottom: '5px' }}><strong>SPACE:</strong> Random belief</div>
                      <div style={{ marginBottom: '5px' }}><strong>C:</strong> Create belief</div>
                      <div style={{ marginBottom: '5px' }}><strong>Drag YOU</strong> to move</div>
                      <div style={{ marginBottom: '5px' }}><strong>Drag belief</strong> to move cluster</div>
                      <div style={{ marginBottom: '5px' }}><strong>Click belief</strong> to remove</div>
                      <div><strong>Shift+Click</strong> to unlock cluster</div>
                    </>
                  )}
                </div>

                {/* Belief Categories */}
                <div style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '12px 16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '0.95em', color: '#1f2937' }}>
                    Belief Categories:
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.entries(categories).map(([key, { color, label }]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ color: '#374151', fontSize: '0.85em' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* What's Happening — full width below canvas */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '16px 20px',
              marginTop: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <span style={{ fontSize: '1.1em' }}>💡</span>
                <h3 style={{ margin: 0, fontSize: '0.95em', color: '#1f2937' }}>What's Happening</h3>
              </div>

              {beliefs.length === 0 ? (
                <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.83em', lineHeight: '1.5' }}>
                  Add beliefs to see insights about your belief system.
                </p>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '12px'
                }}>
                  {holisticInsights.map((insight, i) => (
                    <p key={i} style={{ color: '#374151', margin: 0, lineHeight: '1.6', fontSize: '0.88em' }}>
                      {insight}
                    </p>
                  ))}

                  {Object.entries(clusterConflicts).map(([cat, pairs]) => (
                    <div key={cat} style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: '#fffbeb',
                      border: '1px solid #fde68a'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                        <span>⚡</span>
                        <strong style={{ color: categories[cat].color, fontSize: '0.85em' }}>
                          {categories[cat].label} — internal conflict
                        </strong>
                      </div>
                      {pairs.map(([a, b]) => (
                        <p key={`${a.id}-${b.id}`} style={{ color: '#92400e', fontSize: '0.8em', margin: '0 0 5px 0', fontStyle: 'italic' }}>
                          "{a.text}" vs "{b.text}"
                        </p>
                      ))}
                      <p style={{ color: '#78350f', fontSize: '0.82em', margin: 0, lineHeight: '1.5' }}>
                        {categoryInsights[cat]}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FreedomGame;
