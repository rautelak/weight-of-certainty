import React, { useState, useEffect, useRef } from 'react';
import {
  categories,
  beliefOptions,
  areBeliefsSimilar,
  areBeliefsOpposed,
} from './gameData';
import { generateBeliefSummary } from './beliefSummary';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  getCanvasSizes,
  colors,
  getFreedomColor,
  cardStyle,
  introCardStyle,
  btnPrimary,
  btnSecondary,
  btnGreen,
  btnLarge,
  inputStyle,
} from './styles';

const FreedomGame = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('intro');
  const [player, setPlayer] = useState({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0,
  });
  const [beliefs, setBeliefs] = useState([]);
  const [hoveredBelief, setHoveredBelief] = useState(null);
  const [draggingPlayer, setDraggingPlayer] = useState(false);
  const [draggingCluster, setDraggingCluster] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [lockedClusters, setLockedClusters] = useState(new Set());
  const [showAddBelief, setShowAddBelief] = useState(false);
  const [customBeliefText, setCustomBeliefText] = useState('');
  const [customBeliefCategory, setCustomBeliefCategory] = useState('proven');
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

  const width = CANVAS_WIDTH;
  const height = CANVAS_HEIGHT;


  const getSvgCoordinates = (e, svg) => {
    const rect = svg.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping =
        e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      keysRef.current[e.key] = true;

      if (e.key === ' ' && !isTyping) {
        e.preventDefault();
        if (gameState === 'playing') {
          addRandomBelief();
        }
      }
      if (e.key === 'c' && gameState === 'playing' && !isTyping) {
        setShowAddBelief((prev) => !prev);
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

  useEffect(() => {
    beliefsRef.current = beliefs;
  }, [beliefs]);
  useEffect(() => {
    draggingPlayerRef.current = draggingPlayer;
  }, [draggingPlayer]);
  useEffect(() => {
    lockedClustersRef.current = lockedClusters;
  }, [lockedClusters]);

  const startGame = () => {
    setGameState('playing');
    setBeliefs([]);
    setPlayer({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0 });
    setShowAddBelief(false);
    setLockedClusters(new Set());
    setDraggingCluster(null);
  };

  const addRandomBelief = () => {
    const belief =
      beliefOptions[Math.floor(Math.random() * beliefOptions.length)];
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
    setBeliefs((prev) => {
      if (prev.length >= 20) return prev;
      if (prev.some((b) => b.text.toLowerCase() === text.toLowerCase()))
        return prev;

      const existingInCategory = prev.filter((b) => b.category === category);
      let x, y;

      if (existingInCategory.length > 0) {
        const centerX =
          existingInCategory.reduce((sum, b) => sum + b.x, 0) /
          existingInCategory.length;
        const centerY =
          existingInCategory.reduce((sum, b) => sum + b.y, 0) /
          existingInCategory.length;
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
        vy: 0,
      };

      return [...prev, newBelief];
    });
  };

  const removeBelief = (beliefId) => {
    setBeliefs((prev) => prev.filter((b) => b.id !== beliefId));
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
          setLockedClusters((prev) => {
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
        x: ((x - lastMousePos.current.x) / dt) * 16,
        y: ((y - lastMousePos.current.y) / dt) * 16,
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
      setPlayer((prev) => ({
        ...prev,
        x: Math.max(30, Math.min(width - 30, x)),
        y: Math.max(30, Math.min(height - 30, y)),
        vx: 0,
        vy: 0,
      }));
      return;
    }

    if (draggingCluster) {
      const targetX = x - dragOffset.x;
      const targetY = y - dragOffset.y;

      setBeliefs((prevBeliefs) => {
        const clusterBeliefs = prevBeliefs.filter(
          (b) => b.category === draggingCluster,
        );
        if (clusterBeliefs.length === 0) return prevBeliefs;

        const centerX =
          clusterBeliefs.reduce((sum, b) => sum + b.x, 0) /
          clusterBeliefs.length;
        const centerY =
          clusterBeliefs.reduce((sum, b) => sum + b.y, 0) /
          clusterBeliefs.length;

        const offsetX = targetX - centerX;
        const offsetY = targetY - centerY;

        const otherBeliefs = prevBeliefs.filter(
          (b) => b.category !== draggingCluster,
        );
        const wouldOverlap = clusterBeliefs.some((cb) => {
          const nx = Math.max(30, Math.min(width - 30, cb.x + offsetX));
          const ny = Math.max(30, Math.min(height - 30, cb.y + offsetY));
          return otherBeliefs.some((ob) => {
            const dx = nx - ob.x;
            const dy = ny - ob.y;
            return Math.sqrt(dx * dx + dy * dy) < 50;
          });
        });

        if (wouldOverlap) return prevBeliefs;

        return prevBeliefs.map((belief) => {
          if (belief.category === draggingCluster) {
            return {
              ...belief,
              x: Math.max(30, Math.min(width - 30, belief.x + offsetX)),
              y: Math.max(30, Math.min(height - 30, belief.y + offsetY)),
              vx: 0,
              vy: 0,
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
      const clamp = (v) => Math.max(-10, Math.min(10, v));
      setBeliefs((prev) =>
        prev.map((b) =>
          b.category === draggingCluster
            ? { ...b, vx: clamp(vx), vy: clamp(vy) }
            : b,
        ),
      );
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
    touchStartRef.current = {
      time: Date.now(),
      clientX: t.clientX,
      clientY: t.clientY,
    };
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
        setPlayer((prev) => {
          let newVx = prev.vx;
          let newVy = prev.vy;

          const baseSpeed = 0.4;
          const speedMultiplier = Math.max(
            0.1,
            1 - beliefsRef.current.length * 0.05,
          );
          const speed = baseSpeed * speedMultiplier;

          const currentKeys = keysRef.current;
          const isMoving =
            currentKeys['ArrowLeft'] ||
            currentKeys['a'] ||
            currentKeys['ArrowRight'] ||
            currentKeys['d'] ||
            currentKeys['ArrowUp'] ||
            currentKeys['w'] ||
            currentKeys['ArrowDown'] ||
            currentKeys['s'];

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
                const forceMultiplier = 1 + beliefsRef.current.length * 0.15;
                const force =
                  (distance - maxDistance) * baseForce * forceMultiplier;

                newVx += (dx / distance) * force;
                newVy += (dy / distance) * force;
              }
            });
          }

          const dampingFactor = isMoving
            ? Math.max(0.7, 0.92 - beliefsRef.current.length * 0.015)
            : 0.8;
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
        setBeliefs((prevBeliefs) => {
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

  const freedom = Math.max(0, Math.round(100 - beliefs.length * 5));
  const freedomColor = getFreedomColor(freedom);

  // Find opposing belief pairs within each cluster
  const clusterConflicts = Object.keys(categories).reduce((acc, cat) => {
    const catBeliefs = beliefs.filter((b) => b.category === cat);
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

  const beliefSummary = generateBeliefSummary(beliefs, clusterConflicts);

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: colors.pageBg,
        minHeight: '100vh',
        padding: isMobile ? '10px' : '20px',
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      <div style={{ maxWidth: '1360px', width: '100%', margin: '0 auto' }}>
        {gameState === 'intro' && (
          <div
            style={{
              ...introCardStyle,
              padding: isMobile ? '24px 16px' : '30px 20px',
            }}
          >
            <h1
              style={{
                fontSize: isMobile ? '1.8em' : '2.5em',
                margin: '0 0 15px 0',
                color: colors.textPrimary,
              }}
            >
              The Weight of Certainty
            </h1>
            <p
              style={{
                fontSize: '1.1em',
                color: colors.textMuted,
                marginBottom: '20px',
                lineHeight: '1.6',
              }}
            >
              An interactive exploration of how our beliefs shape our freedom
            </p>
            <div
              style={{
                maxWidth: '600px',
                margin: '0 auto 20px',
                textAlign: 'left',
              }}
            >
              <p style={{ color: colors.textBody, marginBottom: '6px' }}>
                • Start with complete freedom of movement
              </p>
              <p style={{ color: colors.textBody, marginBottom: '6px' }}>
                • Each belief you adopt constrains you slightly
              </p>
              <p style={{ color: colors.textBody, marginBottom: '6px' }}>
                • Similar beliefs cluster together
              </p>
              <p style={{ color: colors.textBody }}>
                • Contradictory beliefs create tension
              </p>
            </div>
            <button onClick={startGame} style={btnLarge}>
              Begin Experience
            </button>
          </div>
        )}

        {gameState === 'playing' && (
          <>
            {/* Header */}
            <div
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '12px 16px',
                marginBottom: '10px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <h2
                style={{
                  fontSize: isMobile ? '1.1em' : '1.4em',
                  margin: 0,
                  color: colors.textPrimary,
                  flex: 1,
                  textAlign: 'center',
                }}
              >
                The Weight of Certainty
              </h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {isMobile && (
                  <button onClick={addRandomBelief} style={btnGreen}>
                    + Random
                  </button>
                )}
                <button
                  onClick={() => setShowAddBelief(!showAddBelief)}
                  style={btnPrimary}
                >
                  {isMobile ? '+ Custom' : 'Create Belief (C)'}
                </button>
                <button onClick={startGame} style={btnSecondary}>
                  Reset
                </button>
              </div>
            </div>

            {/* Stats */}
            <div
              style={{
                ...cardStyle,
                padding: '12px 20px',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-around',
                gap: '15px',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.8em',
                    color: colors.textMuted,
                    marginBottom: '2px',
                  }}
                >
                  Beliefs Held
                </div>
                <div
                  style={{
                    fontSize: '1.5em',
                    fontWeight: '700',
                    color: beliefs.length >= 20 ? '#dc2626' : colors.freedomLow,
                  }}
                >
                  {beliefs.length}/20
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: '0.8em',
                    color: colors.textMuted,
                    marginBottom: '2px',
                  }}
                >
                  Freedom
                </div>
                <div
                  style={{
                    fontSize: '1.5em',
                    fontWeight: '700',
                    color: freedomColor,
                  }}
                >
                  {Math.round(freedom)}%
                </div>
              </div>
            </div>

            {/* Custom belief panel */}
            {showAddBelief && (
              <div
                style={{ ...cardStyle, padding: '16px', marginBottom: '10px' }}
              >
                <h3
                  style={{
                    margin: '0 0 10px 0',
                    fontSize: '1.1em',
                    color: colors.textPrimary,
                  }}
                >
                  Create Custom Belief
                </h3>
                <input
                  type="text"
                  value={customBeliefText}
                  onChange={(e) => setCustomBeliefText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addCustomBelief();
                  }}
                  placeholder="Enter your belief..."
                  style={inputStyle}
                />
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  {Object.keys(categories).map((cat) => (
                    <label
                      key={cat}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        value={cat}
                        checked={customBeliefCategory === cat}
                        onChange={(e) =>
                          setCustomBeliefCategory(e.target.value)
                        }
                        style={{ marginRight: '5px' }}
                      />
                      <span
                        style={{
                          color: categories[cat].color,
                          fontWeight: '600',
                          fontSize: '0.9em',
                        }}
                      >
                        {categories[cat].label}
                      </span>
                    </label>
                  ))}
                </div>
                <button onClick={addCustomBelief} style={btnPrimary}>
                  Add Belief
                </button>
              </div>
            )}

            {/* Canvas + Sidebar */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                flexDirection: isMobile ? 'column' : 'row',
              }}
            >
              <div
                style={{
                  ...cardStyle,
                  padding: '10px',
                  overflow: 'hidden',
                  flex: 1,
                  minWidth: 0,
                }}
              >
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
                    background: colors.canvasBg,
                    borderRadius: '8px',
                    cursor: hoveredBelief
                      ? 'pointer'
                      : draggingPlayer || draggingCluster
                        ? 'grabbing'
                        : 'default',
                    display: 'block',
                    touchAction: 'none',
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

                  <circle
                    cx={player.x}
                    cy={player.y}
                    r="18"
                    fill="#3b82f6"
                    stroke="#1e40af"
                    strokeWidth="3"
                    style={{ cursor: 'grab' }}
                  />
                  <text
                    x={player.x}
                    y={player.y + 5}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="700"
                    fill="white"
                    style={{ pointerEvents: 'none' }}
                  >
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
                    const labelAnchor =
                      lnx > 0.3 ? 'start' : lnx < -0.3 ? 'end' : 'middle';

                    return (
                      <g key={belief.id}>
                        {isHovered && (
                          <circle
                            cx={belief.x}
                            cy={belief.y}
                            r="19"
                            fill={belief.color}
                            opacity="0.2"
                          />
                        )}
                        <circle
                          cx={belief.x}
                          cy={belief.y}
                          r={isHovered ? 16 : 14}
                          fill={belief.color}
                          stroke={
                            isLocked
                              ? colors.lockedStroke
                              : isHovered
                                ? colors.hoveredStroke
                                : colors.beliefStroke
                          }
                          strokeWidth={isLocked ? 4 : isHovered ? 3 : 2.5}
                          strokeDasharray={isLocked ? '4,2' : 'none'}
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
                          {belief.text.substring(0, 25)}
                          {belief.text.length > 25 ? '...' : ''}
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
                  {Object.keys(clusterConflicts).map((cat) => {
                    const catBeliefs = beliefs.filter(
                      (b) => b.category === cat,
                    );
                    const cx =
                      catBeliefs.reduce((s, b) => s + b.x, 0) /
                      catBeliefs.length;
                    const cy =
                      catBeliefs.reduce((s, b) => s + b.y, 0) /
                      catBeliefs.length;
                    return (
                      <g
                        key={`conflict-${cat}`}
                        style={{ pointerEvents: 'none' }}
                      >
                        <circle
                          cx={cx}
                          cy={cy - 38}
                          r="13"
                          fill="#fbbf24"
                          stroke="#f59e0b"
                          strokeWidth="2"
                          opacity="0.95"
                        />
                        <text
                          x={cx}
                          y={cy - 33}
                          textAnchor="middle"
                          fontSize="13"
                        >
                          ⚡
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Sidebar: controls + categories */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  width: isMobile ? '100%' : '200px',
                  flexShrink: 0,
                }}
              >
                {/* Controls hint */}
                <div
                  style={{
                    ...cardStyle,
                    padding: '12px 16px',
                    fontSize: '0.82em',
                    color: colors.textMuted,
                  }}
                >
                  {isMobile ? (
                    <>
                      <div style={{ marginBottom: '5px' }}>
                        <strong>Tap belief</strong> to remove
                      </div>
                      <div style={{ marginBottom: '5px' }}>
                        <strong>Drag YOU</strong> to move
                      </div>
                      <div>
                        <strong>Drag belief</strong> to move cluster
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ marginBottom: '5px' }}>
                        <strong>SPACE:</strong> Random belief
                      </div>
                      <div style={{ marginBottom: '5px' }}>
                        <strong>C:</strong> Create belief
                      </div>
                      <div style={{ marginBottom: '5px' }}>
                        <strong>Drag YOU</strong> to move
                      </div>
                      <div style={{ marginBottom: '5px' }}>
                        <strong>Drag belief</strong> to move cluster
                      </div>
                      <div style={{ marginBottom: '5px' }}>
                        <strong>Click belief</strong> to remove
                      </div>
                      <div>
                        <strong>Shift+Click</strong> to unlock cluster
                      </div>
                    </>
                  )}
                </div>

                {/* Belief Categories */}
                <div style={{ ...cardStyle, padding: '12px 16px' }}>
                  <h3
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '0.95em',
                      color: colors.textPrimary,
                    }}
                  >
                    Belief Categories:
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {Object.entries(categories).map(
                      ([key, { color, label }]) => (
                        <div
                          key={key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              color: colors.textBody,
                              fontSize: '0.85em',
                            }}
                          >
                            {label}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Belief Summary — full width below canvas */}
            <div
              style={{ ...cardStyle, padding: '16px 20px', marginTop: '10px' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '1.1em' }}>💡</span>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '0.95em',
                    color: colors.textPrimary,
                  }}
                >
                  Belief Profile
                </h3>
              </div>

              {!beliefSummary ? (
                <p
                  style={{
                    color: colors.textMuted,
                    margin: 0,
                    fontSize: '0.83em',
                    lineHeight: '1.5',
                  }}
                >
                  Add at least 5 beliefs to generate your belief profile.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {/* Archetype badge */}
                  {beliefSummary.archetype && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: '#f5f3ff',
                        border: '1px solid #ddd6fe',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: '1em',
                            fontWeight: '700',
                            color: '#5b21b6',
                            marginBottom: '3px',
                          }}
                        >
                          {beliefSummary.archetype.name}
                        </div>
                        <div
                          style={{
                            fontSize: '0.82em',
                            color: '#7c3aed',
                            fontStyle: 'italic',
                          }}
                        >
                          {beliefSummary.archetype.tagline}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Narrative paragraphs */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile
                        ? '1fr'
                        : 'repeat(auto-fill, minmax(300px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {beliefSummary.paragraphs.map((p, i) => (
                      <p
                        key={i}
                        style={{
                          color: colors.textBody,
                          margin: 0,
                          lineHeight: '1.65',
                          fontSize: '0.88em',
                        }}
                      >
                        {p}
                      </p>
                    ))}
                  </div>

                  {/* Tension callout */}
                  {beliefSummary.tension && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '6px',
                        }}
                      >
                        <span>⚡</span>
                        <strong
                          style={{ fontSize: '0.85em', color: '#92400e' }}
                        >
                          Active Contradiction
                        </strong>
                      </div>
                      <p
                        style={{
                          color: '#78350f',
                          fontSize: '0.84em',
                          margin: 0,
                          lineHeight: '1.55',
                        }}
                      >
                        {beliefSummary.tension}
                      </p>
                    </div>
                  )}

                  {/* Closing */}
                  <p
                    style={{
                      color: colors.textMuted,
                      margin: 0,
                      fontSize: '0.84em',
                      lineHeight: '1.6',
                      borderTop: '1px solid #f3f4f6',
                      paddingTop: '10px',
                    }}
                  >
                    {beliefSummary.closing}
                  </p>
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
