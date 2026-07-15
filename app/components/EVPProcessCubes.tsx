const cubes = Array.from({ length: 4 });
const faces = Array.from({ length: 4 });

export default function EVPProcessCubes() {
  return (
    <div aria-hidden="true" className="evp-process-cubes">
      {cubes.map((_, cubeIndex) => (
        <div key={cubeIndex} className="evp-process-cube">
          {faces.map((__, faceIndex) => (
            <div key={faceIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}
